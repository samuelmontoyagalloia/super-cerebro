/**
 * E2E tests — full HTTP round-trip with a mocked Google OAuth exchange.
 *
 * The Google OAuth strategy is replaced by a deterministic mock that calls the
 * real verify callback (which hits the real DB).  All other middleware runs as
 * in production.
 *
 * Requires a running PostgreSQL instance accessible via DATABASE_URL.
 * Tests are skipped when the DB is unreachable so the suite stays green in
 * environments without a database.
 */

import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import type { Profile } from 'passport-google-oauth20'

// ── Mock the Google OAuth strategy ───────────────────────────────────────────
// This prevents any real HTTP calls to Google while still exercising the
// verify callback, the Express middleware chain, and the DB layer.

const E2E_PROFILE: Partial<Profile> = {
  id: 'e2e-google-id-999',
  displayName: 'E2E Test User',
  emails: [{ value: 'e2e-test@example.com', verified: true }],
  provider: 'google',
}

vi.mock('passport-google-oauth20', () => {
  class MockGoogleStrategy {
    name = 'google'
    private _verify: Function

    constructor(_options: unknown, verify: Function) {
      this._verify = verify
    }

    // passport calls authenticate(req, options) and sets success/fail/redirect on `this`
    authenticate(this: any, req: any) {
      if (req.query.error) {
        return this.fail({ message: String(req.query.error) })
      }

      if (req.query.code) {
        this._verify(
          'e2e-access-token',
          'e2e-refresh-token',
          E2E_PROFILE,
          (err: Error | null, user: unknown) => {
            if (err) return this.error(err)
            if (!user) return this.fail({ message: 'No user returned' })
            this.success(user)
          }
        )
        return
      }

      this.redirect('https://accounts.google.com/o/oauth2/v2/auth?mock=e2e')
    }
  }

  return { Strategy: MockGoogleStrategy }
})

// ── Setup ─────────────────────────────────────────────────────────────────────

import { PrismaClient } from '../../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import type { Express } from 'express'

let app: Express
let prisma: PrismaClient
let dbAvailable = false

beforeAll(async () => {
  // Attempt a real DB connection; skip suite if it fails
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  prisma = new PrismaClient({ adapter })

  try {
    await prisma.$queryRaw`SELECT 1`
    dbAvailable = true
  } catch {
    dbAvailable = false
  }

  if (!dbAvailable) return

  const { createApp } = await import('../../app.js')
  app = createApp()
})

afterEach(async () => {
  if (!dbAvailable) return
  // Remove any test users created during the run
  await prisma.user.deleteMany({
    where: { email: { in: ['e2e-test@example.com'] } },
  })
})

afterAll(async () => {
  await prisma?.$disconnect()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('E2E — Google OAuth flow', () => {
  describe('GET /auth/google', () => {
    it('redirects to the mocked Google authorization URL', async () => {
      if (!dbAvailable) return

      const res = await supertest(app).get('/auth/google')

      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('accounts.google.com')
    })
  })

  describe('GET /auth/google/callback — new user', () => {
    it('creates the user in the database', async () => {
      if (!dbAvailable) return

      await supertest(app).get('/auth/google/callback?code=fake-code')

      const user = await prisma.user.findUnique({
        where: { googleId: E2E_PROFILE.id },
      })
      expect(user).not.toBeNull()
      expect(user!.email).toBe('e2e-test@example.com')
      expect(user!.name).toBe('E2E Test User')
      expect(user!.googleId).toBe('e2e-google-id-999')
    })

    it('redirects to the frontend with a valid JWT', async () => {
      if (!dbAvailable) return

      const res = await supertest(app).get('/auth/google/callback?code=fake-code')

      expect(res.status).toBe(302)
      expect(res.headers.location).toMatch(/^https:\/\/cerebro\.samuelmontoya\.com\?token=/)

      const token = new URL(res.headers.location).searchParams.get('token')!
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      expect(typeof payload.userId).toBe('string')
      expect(payload.userId).toBeTruthy()
    })
  })

  describe('GET /auth/google/callback — existing user', () => {
    it('returns existing user without creating a duplicate', async () => {
      if (!dbAvailable) return

      // First call: creates the user
      await supertest(app).get('/auth/google/callback?code=fake-code')
      const first = await prisma.user.findUnique({
        where: { googleId: E2E_PROFILE.id },
      })

      // Second call: should reuse the same record
      await supertest(app).get('/auth/google/callback?code=fake-code')
      const count = await prisma.user.count({
        where: { googleId: E2E_PROFILE.id },
      })

      expect(count).toBe(1)
      const second = await prisma.user.findUnique({
        where: { googleId: E2E_PROFILE.id },
      })
      expect(second!.id).toBe(first!.id)
    })
  })

  describe('GET /auth/google/callback — OAuth failure', () => {
    it('redirects to / when Google returns an error', async () => {
      if (!dbAvailable) return

      const res = await supertest(app).get(
        '/auth/google/callback?error=access_denied'
      )

      expect(res.status).toBe(302)
      expect(res.headers.location).toBe('/')
    })
  })
})
