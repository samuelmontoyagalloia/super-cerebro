/**
 * Unit tests — app.ts PUBLIC_PATHS configuration.
 *
 * Verifies that the global authenticate middleware in app.ts correctly
 * bypasses JWT validation for public routes and enforces it on protected ones.
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import type { Express } from 'express'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => ({
  default: {
    user:    { findUnique: vi.fn() },
    passkey: { create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions:   vi.fn(),
  verifyRegistrationResponse:    vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse:  vi.fn(),
}))

vi.mock('../../config/passport.js', () => ({}))

// ── Setup ─────────────────────────────────────────────────────────────────────

import prisma from '../../lib/prisma.js'

const VALID_JWT = jwt.sign({ userId: 'test-user' }, process.env.JWT_SECRET!, { expiresIn: '1h' })

let app: Express

beforeAll(async () => {
  const { createApp } = await import('../../app.js')
  app = createApp()
})

beforeEach(() => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
})

// ── PUBLIC_PATHS — no token required ─────────────────────────────────────────

describe('PUBLIC_PATHS — no token required', () => {
  it('GET /api/health returns 200 without an Authorization header', async () => {
    const res = await supertest(app).get('/api/health')
    expect(res.status).toBe(200)
  })

  it('POST /auth/passkey/login/start passes auth middleware (returns 400 for missing email, not 401)', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({})
    expect(res.status).toBe(400)
    expect(res.status).not.toBe(401)
  })

  it('POST /auth/passkey/login/finish passes auth middleware (returns 400 for missing body, not 401)', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({})
    expect(res.status).toBe(400)
    expect(res.status).not.toBe(401)
  })

  it('GET /auth/google is not blocked by auth middleware (does not return 401)', async () => {
    const res = await supertest(app).get('/auth/google')
    expect(res.status).not.toBe(401)
  })
})

// ── Protected routes — token required ────────────────────────────────────────

describe('Protected routes — token required', () => {
  it('POST /auth/passkey/register/start returns 401 { error: "No token provided" } without a token', async () => {
    const res = await supertest(app).post('/auth/passkey/register/start')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'No token provided' })
  })

  it('POST /auth/passkey/register/finish returns 401 { error: "No token provided" } without a token', async () => {
    const res = await supertest(app).post('/auth/passkey/register/finish')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'No token provided' })
  })

  it('POST /auth/passkey/register/start with a valid JWT is not rejected by auth (returns non-401)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test',
      passkeys: [],
    } as any)

    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${VALID_JWT}`)

    expect(res.status).not.toBe(401)
  })

  it('POST /auth/passkey/register/start returns 401 { error: "Invalid token" } for a bad token', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', 'Bearer this-is-not-a-jwt')

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'Invalid token' })
  })
})

// ── OPTIONS preflight bypasses auth ──────────────────────────────────────────

describe('OPTIONS preflight bypasses auth middleware', () => {
  it('OPTIONS /auth/passkey/register/start returns 204 (CORS handles it before auth)', async () => {
    const res = await supertest(app)
      .options('/auth/passkey/register/start')
      .set('Origin', process.env.FRONTEND_URL ?? 'http://localhost:5173')

    expect(res.status).toBe(204)
  })
})
