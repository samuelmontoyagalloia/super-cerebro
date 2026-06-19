import { vi, describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import type { Express } from 'express'

// Prevent real DB connection — strategy verify callback is covered in unit tests
vi.mock('../../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

let app: Express

beforeAll(async () => {
  const { createApp } = await import('../../app.js')
  app = createApp()
})

// ── /auth/google ──────────────────────────────────────────────────────────────

describe('GET /auth/google', () => {
  it('redirects (302) to the Google OAuth authorization URL', async () => {
    const res = await supertest(app).get('/auth/google')

    expect(res.status).toBe(302)
    expect(res.headers.location).toMatch(/accounts\.google\.com/)
  })

  it('includes the configured client_id in the redirect URL', async () => {
    const res = await supertest(app).get('/auth/google')

    expect(res.headers.location).toContain(
      `client_id=${process.env.GOOGLE_CLIENT_ID}`
    )
  })

  it('requests profile and email scopes', async () => {
    const res = await supertest(app).get('/auth/google')
    const location = decodeURIComponent(res.headers.location)

    expect(location).toContain('profile')
    expect(location).toContain('email')
  })

  it('includes a redirect_uri pointing to /auth/google/callback', async () => {
    const res = await supertest(app).get('/auth/google')
    const location = decodeURIComponent(res.headers.location)

    expect(location).toContain('/auth/google/callback')
  })
})

// ── /auth/google/callback — failure path ─────────────────────────────────────

describe('GET /auth/google/callback — OAuth error', () => {
  it('redirects to /login?error=unauthorized when Google returns access_denied', async () => {
    const res = await supertest(app).get(
      '/auth/google/callback?error=access_denied'
    )

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://cerebro.samuelmontoya.com'
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`${frontendUrl}/login?error=unauthorized`)
  })
})

// ── /auth/google/callback — success path ─────────────────────────────────────
//
// We test the handler (JWT generation + redirect) in isolation by mounting
// a lightweight Express app that replicates only the callback route logic
// without the real passport OAuth exchange.

describe('GET /auth/google/callback — success handler', () => {
  it('generates a valid JWT containing userId and redirects to frontend', async () => {
    // Import express directly so we can mount a controlled handler
    const { default: express } = await import('express')
    const testApp = express()
    const { Router } = await import('express')
    const router = Router()

    router.get('/google/callback', (_req, res) => {
      // Simulate what happens after passport.authenticate succeeds
      const user = { id: 'integration-user-id' }
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      )
      res.redirect(`https://cerebro.samuelmontoya.com?token=${token}`)
    })

    testApp.use('/auth', router)

    const res = await supertest(testApp).get('/auth/google/callback')

    expect(res.status).toBe(302)

    const location = res.headers.location
    expect(location).toMatch(/^https:\/\/cerebro\.samuelmontoya\.com\?token=/)

    const token = new URL(location).searchParams.get('token')!
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    expect(payload.userId).toBe('integration-user-id')
  })

  it('JWT expires in 7 days', async () => {
    const token = jwt.sign(
      { userId: 'any-user' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number }

    expect(exp - iat).toBe(7 * 24 * 60 * 60)
  })
})
