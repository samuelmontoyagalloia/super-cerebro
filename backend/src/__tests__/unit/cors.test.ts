/**
 * Unit tests — CORS middleware (app.ts).
 *
 * Verifies that cross-origin headers are set only for allowed origins,
 * and that OPTIONS preflight requests are handled correctly.
 */

import { vi, describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
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

// ── Setup ─────────────────────────────────────────────────────────────────────

let app: Express

beforeAll(async () => {
  const { createApp } = await import('../../app.js')
  app = createApp()
})

const FRONTEND_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const PROD_ORIGIN     = 'https://cerebro.samuelmontoya.com'

// ── Allowed origins ───────────────────────────────────────────────────────────

describe('CORS middleware — allowed origins', () => {
  it('sets Access-Control-Allow-Origin for the FRONTEND_URL origin', async () => {
    const res = await supertest(app)
      .get('/api/health')
      .set('Origin', FRONTEND_ORIGIN)

    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
  })

  it('sets Access-Control-Allow-Origin for the production domain', async () => {
    const res = await supertest(app)
      .get('/api/health')
      .set('Origin', PROD_ORIGIN)

    expect(res.headers['access-control-allow-origin']).toBe(PROD_ORIGIN)
  })

  it('exposes Allow-Methods (includes POST) for allowed origins', async () => {
    const res = await supertest(app)
      .get('/api/health')
      .set('Origin', FRONTEND_ORIGIN)

    expect(res.headers['access-control-allow-methods']).toContain('POST')
  })

  it('exposes Allow-Headers (includes Authorization and Content-Type) for allowed origins', async () => {
    const res = await supertest(app)
      .get('/api/health')
      .set('Origin', FRONTEND_ORIGIN)

    expect(res.headers['access-control-allow-headers']).toContain('Authorization')
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type')
  })

  it('reflects the exact request origin — not a wildcard *', async () => {
    const res = await supertest(app)
      .get('/api/health')
      .set('Origin', FRONTEND_ORIGIN)

    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
    expect(res.headers['access-control-allow-origin']).not.toBe('*')
  })
})

// ── Blocked origins ───────────────────────────────────────────────────────────

describe('CORS middleware — blocked origins', () => {
  it('does NOT set CORS headers for an unknown origin', async () => {
    const res = await supertest(app)
      .get('/api/health')
      .set('Origin', 'https://evil.com')

    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('does NOT set CORS headers when no Origin header is present', async () => {
    const res = await supertest(app).get('/api/health')

    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})

// ── OPTIONS preflight ─────────────────────────────────────────────────────────

describe('CORS middleware — OPTIONS preflight', () => {
  it('returns 204 with CORS headers for an allowed origin', async () => {
    const res = await supertest(app)
      .options('/auth/passkey/register/start')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN)
    expect(res.headers['access-control-allow-methods']).toContain('POST')
  })

  it('returns 204 for an unknown origin but WITHOUT CORS headers', async () => {
    const res = await supertest(app)
      .options('/auth/passkey/register/start')
      .set('Origin', 'https://attacker.com')

    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})
