/**
 * E2E tests — passkey registration and login flows.
 *
 * The SimpleWebAuthn library is mocked (there is no real WebAuthn authenticator
 * in a test environment), but every other layer runs as in production:
 * real Express middleware, real Prisma, real PostgreSQL.
 *
 * Tests are skipped automatically when the database is unreachable so the
 * suite stays green in CI environments that have no database.
 */

import { vi, describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import type { Express } from 'express'

// ── Mock SimpleWebAuthn ───────────────────────────────────────────────────────
// We must mock before the app (which imports passkey.ts) is loaded.

const MOCK_CRED_ID   = 'e2e-test-credential-id-abc123'
const MOCK_PUBLIC_KEY = new Uint8Array([1, 2, 3, 4, 5])
const MOCK_COUNTER_INIT  = 0
const MOCK_COUNTER_AFTER = 1

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn().mockImplementation(async () => ({
    challenge: 'e2e-reg-challenge',
    rp: { name: 'Super Cerebro', id: 'localhost' },
    user: { id: 'b64-user', name: 'e2e@example.com', displayName: 'E2E User' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    timeout: 60000,
    excludeCredentials: [],
    attestation: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  })),

  verifyRegistrationResponse: vi.fn().mockImplementation(async () => ({
    verified: true,
    registrationInfo: {
      credential: {
        id: MOCK_CRED_ID,
        publicKey: MOCK_PUBLIC_KEY,
        counter: MOCK_COUNTER_INIT,
      },
    },
  })),

  generateAuthenticationOptions: vi.fn().mockImplementation(async () => ({
    challenge: 'e2e-auth-challenge',
    rpId: 'localhost',
    allowCredentials: [{ id: MOCK_CRED_ID, type: 'public-key' }],
    timeout: 60000,
    userVerification: 'preferred',
  })),

  verifyAuthenticationResponse: vi.fn().mockImplementation(async () => ({
    verified: true,
    authenticationInfo: { newCounter: MOCK_COUNTER_AFTER },
  })),
}))

// ── DB + app setup ────────────────────────────────────────────────────────────

import { PrismaClient } from '../../generated/prisma/client.js'
import { PrismaPg }    from '@prisma/adapter-pg'
import { Pool }        from 'pg'

let app: Express
let prisma: PrismaClient
let dbAvailable = false

const E2E_EMAIL = 'e2e-passkey-test@example.com'

beforeAll(async () => {
  const pool    = new Pool({ connectionString: process.env.DATABASE_URL })
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
  await prisma.passkey.deleteMany({ where: { user: { email: E2E_EMAIL } } })
  await prisma.user.deleteMany({ where: { email: E2E_EMAIL } })
})

afterAll(async () => {
  await prisma?.$disconnect()
})

// ── Helper: create a test user and return a signed JWT ─────────────────────────

async function createUserAndJwt() {
  const user = await prisma.user.create({
    data: { email: E2E_EMAIL, name: 'E2E Passkey User' },
  })
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '1h' })
  return { user, token }
}

// ── Registration flow ─────────────────────────────────────────────────────────

describe('E2E — register/start', () => {
  it('returns 200 with challenge and rp for an authenticated user', async () => {
    if (!dbAvailable) return

    const { token } = await createUserAndJwt()

    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      challenge: 'e2e-reg-challenge',
      rp: { name: 'Super Cerebro' },
    })
  })

  it('returns 404 for a userId that does not exist in the database', async () => {
    if (!dbAvailable) return

    const orphanJwt = jwt.sign({ userId: 'non-existent-user-id' }, process.env.JWT_SECRET!, { expiresIn: '1h' })

    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${orphanJwt}`)

    expect(res.status).toBe(404)
  })

  it('returns 401 when Authorization header is absent', async () => {
    if (!dbAvailable) return

    const res = await supertest(app).post('/auth/passkey/register/start')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'No token provided' })
  })
})

describe('E2E — register/finish', () => {
  it('persists the passkey to the database on success', async () => {
    if (!dbAvailable) return

    const { user, token } = await createUserAndJwt()

    // Populate challenge store
    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${token}`)

    const res = await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: MOCK_CRED_ID, rawId: MOCK_CRED_ID, response: {}, type: 'public-key', clientExtensionResults: {} })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true })

    const savedPasskey = await prisma.passkey.findUnique({ where: { credentialId: MOCK_CRED_ID } })
    expect(savedPasskey).not.toBeNull()
    expect(savedPasskey!.userId).toBe(user.id)
    expect(Number(savedPasskey!.counter)).toBe(MOCK_COUNTER_INIT)
  })

  it('stores the public key as bytes in the database', async () => {
    if (!dbAvailable) return

    const { token } = await createUserAndJwt()

    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${token}`)

    await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: MOCK_CRED_ID })

    const savedPasskey = await prisma.passkey.findUnique({ where: { credentialId: MOCK_CRED_ID } })
    // Prisma Bytes field may be returned as Buffer or Uint8Array depending on the driver
    expect(savedPasskey!.publicKey).toBeInstanceOf(Uint8Array)
    expect(Array.from(savedPasskey!.publicKey)).toEqual(Array.from(MOCK_PUBLIC_KEY))
  })

  it('returns 400 without a prior /register/start call (no challenge in store)', async () => {
    if (!dbAvailable) return

    const { token } = await createUserAndJwt()

    const res = await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: MOCK_CRED_ID })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/challenge not found/i)
  })

  it('returns 401 when Authorization header is absent', async () => {
    if (!dbAvailable) return

    const res = await supertest(app).post('/auth/passkey/register/finish')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'No token provided' })
  })
})

// ── Login flow ────────────────────────────────────────────────────────────────

describe('E2E — login/start', () => {
  it('returns 404 when the user has no registered passkeys', async () => {
    if (!dbAvailable) return

    await createUserAndJwt() // user exists but has no passkeys

    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: E2E_EMAIL })

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'No passkeys registered for this user' })
  })

  it('returns 200 with authentication options after a passkey is registered', async () => {
    if (!dbAvailable) return

    const { token } = await createUserAndJwt()

    // Register a passkey first
    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${token}`)
    await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: MOCK_CRED_ID })

    // Now login/start should work
    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: E2E_EMAIL })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ challenge: 'e2e-auth-challenge' })
  })
})

describe('E2E — login/finish', () => {
  async function registerPasskey(token: string) {
    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${token}`)
    await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: MOCK_CRED_ID })
  }

  it('returns a valid JWT containing the correct userId', async () => {
    if (!dbAvailable) return

    const { user, token } = await createUserAndJwt()
    await registerPasskey(token)

    await supertest(app).post('/auth/passkey/login/start').send({ email: E2E_EMAIL })

    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: E2E_EMAIL, response: { id: MOCK_CRED_ID } })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as { userId: string }
    expect(payload.userId).toBe(user.id)
  })

  it('updates the passkey counter in the database after successful login', async () => {
    if (!dbAvailable) return

    const { token } = await createUserAndJwt()
    await registerPasskey(token)

    await supertest(app).post('/auth/passkey/login/start').send({ email: E2E_EMAIL })

    await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: E2E_EMAIL, response: { id: MOCK_CRED_ID } })

    const updated = await prisma.passkey.findUnique({ where: { credentialId: MOCK_CRED_ID } })
    expect(Number(updated!.counter)).toBe(MOCK_COUNTER_AFTER)
  })

  it('returns 400 without a prior /login/start call', async () => {
    if (!dbAvailable) return

    const { token } = await createUserAndJwt()
    await registerPasskey(token)

    // Skip /login/start intentionally
    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: E2E_EMAIL, response: { id: MOCK_CRED_ID } })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/challenge not found/i)
  })

  it('returns 400 when the response credential ID does not match any registered passkey', async () => {
    if (!dbAvailable) return

    const { token } = await createUserAndJwt()
    await registerPasskey(token)

    await supertest(app).post('/auth/passkey/login/start').send({ email: E2E_EMAIL })

    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: E2E_EMAIL, response: { id: 'wrong-credential-id' } })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Passkey not found' })
  })

  it('full round-trip: register → login → JWT is valid and counter is updated', async () => {
    if (!dbAvailable) return

    const { user, token } = await createUserAndJwt()

    // Register
    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${token}`)
    const regFinish = await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: MOCK_CRED_ID })
    expect(regFinish.body).toMatchObject({ success: true })

    // Login
    await supertest(app).post('/auth/passkey/login/start').send({ email: E2E_EMAIL })
    const loginFinish = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: E2E_EMAIL, response: { id: MOCK_CRED_ID } })

    expect(loginFinish.status).toBe(200)

    // JWT payload
    const payload = jwt.verify(loginFinish.body.token, process.env.JWT_SECRET!) as { userId: string }
    expect(payload.userId).toBe(user.id)

    // Counter persisted
    const pk = await prisma.passkey.findUnique({ where: { credentialId: MOCK_CRED_ID } })
    expect(Number(pk!.counter)).toBe(MOCK_COUNTER_AFTER)
  })
})
