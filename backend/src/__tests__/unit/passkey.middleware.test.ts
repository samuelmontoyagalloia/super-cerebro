/**
 * Unit tests — passkey route: JWT middleware and input validation.
 *
 * All dependencies (Prisma, SimpleWebAuthn) are mocked so the tests
 * exercise only the request/response logic inside passkey.ts.
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
  generateRegistrationOptions:  vi.fn().mockResolvedValue({ challenge: 'mock-reg-challenge',  rp: {}, user: {}, pubKeyCredParams: [] }),
  verifyRegistrationResponse:   vi.fn().mockResolvedValue({ verified: true, registrationInfo: { credential: { id: 'cred-id', publicKey: new Uint8Array([1]), counter: 0 } } }),
  generateAuthenticationOptions: vi.fn().mockResolvedValue({ challenge: 'mock-auth-challenge', rpId: 'localhost', allowCredentials: [] }),
  verifyAuthenticationResponse:  vi.fn().mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 1 } }),
}))

// ── Setup ─────────────────────────────────────────────────────────────────────

import prisma from '../../lib/prisma.js'

const SECRET    = process.env.JWT_SECRET!
const USER_ID   = 'unit-passkey-user'
const USER_EMAIL = 'unit-passkey@example.com'
const VALID_JWT  = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: '1h' })

const MOCK_USER = {
  id: USER_ID,
  email: USER_EMAIL,
  name: 'Unit Test',
  passkeys: [],
}

let app: Express

beforeAll(async () => {
  const { createApp } = await import('../../app.js')
  app = createApp()
})

beforeEach(() => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as any)
  vi.mocked(prisma.passkey.create).mockResolvedValue({} as any)
  vi.mocked(prisma.passkey.update).mockResolvedValue({} as any)
})

// ── authenticate — missing / malformed header ─────────────────────────────────

describe('authenticate middleware — protected routes reject bad credentials', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const res = await supertest(app).post('/auth/passkey/register/start')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'No token provided' })
  })

  it('returns 401 when header does not start with "Bearer "', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'No token provided' })
  })

  it('returns 401 for a plain string that is not a JWT', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'Invalid token' })
  })

  it('returns 401 for a JWT signed with a different secret', async () => {
    const badToken = jwt.sign({ userId: USER_ID }, 'totally-wrong-secret')
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${badToken}`)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'Invalid token' })
  })

  it('returns 401 for an expired JWT', async () => {
    const expired = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: '-1s' })
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${expired}`)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'Invalid token' })
  })

  it('returns 401 for a JWT with a tampered payload', async () => {
    const [header, , sig] = VALID_JWT.split('.')
    const fakePayload = Buffer.from(JSON.stringify({ userId: 'attacker' })).toString('base64url')
    const tampered = `${header}.${fakePayload}.${sig}`
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${tampered}`)
    expect(res.status).toBe(401)
  })

  it('passes through to the handler when the JWT is valid', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${VALID_JWT}`)
    // Prisma mock returns a user → handler proceeds → 200
    expect(res.status).toBe(200)
  })
})

// ── register/start — handler validation ──────────────────────────────────────

describe('register/start — handler behaviour', () => {
  it('returns 404 when the user is not found in the database', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${VALID_JWT}`)
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'User not found' })
  })

  it('returns 200 with WebAuthn options when the user exists', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${VALID_JWT}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('challenge')
    expect(res.body).toHaveProperty('rp')
  })

  it('includes existing credentials in excludeCredentials to prevent re-registration', async () => {
    const { generateRegistrationOptions } = await import('@simplewebauthn/server')
    const userWithPasskey = {
      ...MOCK_USER,
      passkeys: [{ credentialId: 'existing-cred-abc', publicKey: Buffer.from([]), counter: BigInt(0) }],
    }
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(userWithPasskey as any)

    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${VALID_JWT}`)

    expect(vi.mocked(generateRegistrationOptions)).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeCredentials: expect.arrayContaining([
          expect.objectContaining({ id: 'existing-cred-abc' }),
        ]),
      })
    )
  })
})

// ── login/start — input validation ───────────────────────────────────────────

describe('login/start — input validation', () => {
  it('returns 400 when email is missing from the request body', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'email is required' })
  })

  it('returns 404 when the user has no passkeys registered', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...MOCK_USER, passkeys: [] } as any)
    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: USER_EMAIL })
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'No passkeys registered for this user' })
  })

  it('returns 404 when the user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: 'ghost@example.com' })
    expect(res.status).toBe(404)
  })
})

// ── login/finish — input validation ──────────────────────────────────────────

describe('login/finish — input validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ response: { id: 'x' } })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'email and response are required' })
  })

  it('returns 400 when response is missing', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: USER_EMAIL })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'email and response are required' })
  })

  it('returns 404 when the user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: 'ghost@example.com', response: { id: 'x' } })
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'User not found' })
  })
})
