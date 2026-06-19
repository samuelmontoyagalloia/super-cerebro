/**
 * Integration tests — passkey routes.
 *
 * Exercises the complete Express middleware chain (JWT guard → handler → response)
 * with Prisma and SimpleWebAuthn both mocked.  The in-memory challengeStore is
 * real, so start→finish flows test the actual state hand-off between the two
 * endpoints without touching a database or a WebAuthn authenticator.
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

const MOCK_GENERATE_REG_OPTS = vi.fn()
const MOCK_VERIFY_REG        = vi.fn()
const MOCK_GENERATE_AUTH_OPTS = vi.fn()
const MOCK_VERIFY_AUTH       = vi.fn()

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions:   MOCK_GENERATE_REG_OPTS,
  verifyRegistrationResponse:    MOCK_VERIFY_REG,
  generateAuthenticationOptions: MOCK_GENERATE_AUTH_OPTS,
  verifyAuthenticationResponse:  MOCK_VERIFY_AUTH,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

import prisma from '../../lib/prisma.js'

const SECRET     = process.env.JWT_SECRET!
const USER_ID    = 'integ-passkey-user-1'
const USER_EMAIL = 'integ-passkey@example.com'
const CRED_ID    = 'integ-credential-id-abc'

const makeJwt = (userId = USER_ID) =>
  jwt.sign({ userId }, SECRET, { expiresIn: '1h' })

const MOCK_USER_NO_PASSKEYS = {
  id: USER_ID,
  email: USER_EMAIL,
  name: 'Integration User',
  passkeys: [],
}

const MOCK_USER_WITH_PASSKEY = {
  ...MOCK_USER_NO_PASSKEYS,
  passkeys: [
    {
      id: 'pk-row-1',
      userId: USER_ID,
      credentialId: CRED_ID,
      publicKey: Buffer.from([10, 20, 30]),
      counter: BigInt(5),
    },
  ],
}

let app: Express

beforeAll(async () => {
  const { createApp } = await import('../../app.js')
  app = createApp()
})

beforeEach(() => {
  vi.clearAllMocks()

  // Default happy-path mock values
  MOCK_GENERATE_REG_OPTS.mockResolvedValue({
    challenge: 'reg-challenge-abc',
    rp: { name: 'Super Cerebro', id: 'localhost' },
    user: { id: 'b64-user', name: USER_EMAIL, displayName: 'Integration User' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    timeout: 60000,
    excludeCredentials: [],
    attestation: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  })

  MOCK_VERIFY_REG.mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: { id: CRED_ID, publicKey: new Uint8Array([10, 20, 30]), counter: 0 },
    },
  })

  MOCK_GENERATE_AUTH_OPTS.mockResolvedValue({
    challenge: 'auth-challenge-xyz',
    rpId: 'localhost',
    allowCredentials: [{ id: CRED_ID, type: 'public-key' }],
    timeout: 60000,
    userVerification: 'preferred',
  })

  MOCK_VERIFY_AUTH.mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 6 },
  })

  vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER_NO_PASSKEYS as any)
  vi.mocked(prisma.passkey.create).mockResolvedValue({} as any)
  vi.mocked(prisma.passkey.update).mockResolvedValue({} as any)
})

// ── POST /auth/passkey/register/start ─────────────────────────────────────────

describe('POST /auth/passkey/register/start', () => {
  it('returns 200 with challenge and rp fields', async () => {
    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${makeJwt()}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      challenge: 'reg-challenge-abc',
      rp: { name: 'Super Cerebro' },
    })
  })

  it('passes rpName "Super Cerebro" and rpID "localhost" (dev env) to SimpleWebAuthn', async () => {
    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${makeJwt()}`)

    expect(MOCK_GENERATE_REG_OPTS).toHaveBeenCalledWith(
      expect.objectContaining({ rpName: 'Super Cerebro', rpID: 'localhost' })
    )
  })

  it('sets userName to the user email', async () => {
    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${makeJwt()}`)

    expect(MOCK_GENERATE_REG_OPTS).toHaveBeenCalledWith(
      expect.objectContaining({ userName: USER_EMAIL })
    )
  })

  it('passes existing credential IDs as excludeCredentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(MOCK_USER_WITH_PASSKEY as any)

    await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${makeJwt()}`)

    expect(MOCK_GENERATE_REG_OPTS).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeCredentials: [{ id: CRED_ID }],
      })
    )
  })

  it('returns 404 when user is not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

    const res = await supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${makeJwt()}`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'User not found' })
  })
})

// ── POST /auth/passkey/register/finish ────────────────────────────────────────

describe('POST /auth/passkey/register/finish', () => {
  const callStart = () =>
    supertest(app)
      .post('/auth/passkey/register/start')
      .set('Authorization', `Bearer ${makeJwt()}`)

  it('returns 400 when /register/start was not called first', async () => {
    // Use a different userId so there is no challenge in the store
    const freshJwt = makeJwt('no-challenge-user-xyz')
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...MOCK_USER_NO_PASSKEYS,
      id: 'no-challenge-user-xyz',
    } as any)

    const res = await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${freshJwt}`)
      .send({ id: CRED_ID })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/challenge not found/i)
  })

  it('returns 400 with the error message when verifyRegistrationResponse throws', async () => {
    await callStart()
    MOCK_VERIFY_REG.mockRejectedValueOnce(new Error('Bad attestation format'))

    const res = await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ id: CRED_ID, rawId: CRED_ID, response: {}, type: 'public-key', clientExtensionResults: {} })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Bad attestation format' })
  })

  it('returns 400 when verified is false', async () => {
    await callStart()
    MOCK_VERIFY_REG.mockResolvedValueOnce({ verified: false })

    const res = await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ id: CRED_ID })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Verification failed' })
  })

  it('returns { success: true } and creates the passkey in the DB on success', async () => {
    await callStart()

    const res = await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ id: CRED_ID })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true })
    expect(prisma.passkey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          credentialId: CRED_ID,
          counter: 0,
        }),
      })
    )
  })

  it('clears the challenge from the store after successful registration', async () => {
    // First registration
    await callStart()
    await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ id: CRED_ID })

    // Calling /finish again without a new /start should fail
    const res = await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ id: CRED_ID })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/challenge not found/i)
  })

  it('does not create a passkey in the DB when verification fails', async () => {
    await callStart()
    MOCK_VERIFY_REG.mockResolvedValueOnce({ verified: false })

    await supertest(app)
      .post('/auth/passkey/register/finish')
      .set('Authorization', `Bearer ${makeJwt()}`)
      .send({ id: CRED_ID })

    expect(prisma.passkey.create).not.toHaveBeenCalled()
  })
})

// ── POST /auth/passkey/login/start ────────────────────────────────────────────

describe('POST /auth/passkey/login/start', () => {
  it('returns 200 with authentication options when the user has passkeys', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(MOCK_USER_WITH_PASSKEY as any)

    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: USER_EMAIL })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ challenge: 'auth-challenge-xyz' })
  })

  it('passes the user credential IDs as allowCredentials to SimpleWebAuthn', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(MOCK_USER_WITH_PASSKEY as any)

    await supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: USER_EMAIL })

    expect(MOCK_GENERATE_AUTH_OPTS).toHaveBeenCalledWith(
      expect.objectContaining({
        rpID: 'localhost',
        allowCredentials: [{ id: CRED_ID }],
      })
    )
  })

  it('returns 404 when user has no passkeys', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(MOCK_USER_NO_PASSKEYS as any)

    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: USER_EMAIL })

    expect(res.status).toBe(404)
  })

  it('returns 404 when the user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

    const res = await supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: 'ghost@example.com' })

    expect(res.status).toBe(404)
  })
})

// ── POST /auth/passkey/login/finish ───────────────────────────────────────────

describe('POST /auth/passkey/login/finish', () => {
  const LOGIN_USER_ID = 'integ-login-user-2'
  const LOGIN_EMAIL   = 'integ-login2@example.com'

  const loginUser = {
    id: LOGIN_USER_ID,
    email: LOGIN_EMAIL,
    name: 'Login User',
    passkeys: [
      {
        id: 'pk-row-2',
        userId: LOGIN_USER_ID,
        credentialId: CRED_ID,
        publicKey: Buffer.from([10, 20, 30]),
        counter: BigInt(5),
      },
    ],
  }

  const callLoginStart = () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)
    return supertest(app)
      .post('/auth/passkey/login/start')
      .send({ email: LOGIN_EMAIL })
  }

  it('returns 400 when /login/start was not called first', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...loginUser,
      id: 'no-challenge-login-user',
    } as any)

    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/challenge not found/i)
  })

  it('returns 400 when the credential ID is not found among the user passkeys', async () => {
    await callLoginStart()
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)

    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: 'unknown-credential-id' } })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Passkey not found' })
  })

  it('returns 400 with error message when verifyAuthenticationResponse throws', async () => {
    await callLoginStart()
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)
    MOCK_VERIFY_AUTH.mockRejectedValueOnce(new Error('Invalid signature'))

    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Invalid signature' })
  })

  it('returns 401 when verified is false', async () => {
    await callLoginStart()
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)
    MOCK_VERIFY_AUTH.mockResolvedValueOnce({ verified: false })

    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'Authentication failed' })
  })

  it('returns a valid JWT containing userId on success', async () => {
    await callLoginStart()
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)

    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')

    const payload = jwt.verify(res.body.token, SECRET) as { userId: string }
    expect(payload.userId).toBe(LOGIN_USER_ID)
  })

  it('JWT expires in 7 days', async () => {
    await callLoginStart()
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)

    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    const { iat, exp } = jwt.decode(res.body.token) as { iat: number; exp: number }
    expect(exp - iat).toBe(7 * 24 * 60 * 60)
  })

  it('updates the passkey counter in the DB after successful authentication', async () => {
    await callLoginStart()
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)

    await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    expect(prisma.passkey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { credentialId: CRED_ID },
        data: { counter: 6 },
      })
    )
  })

  it('clears the challenge from the store after successful login', async () => {
    await callLoginStart()
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)

    await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    // Second /finish without a new /start must fail
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)
    const res = await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/challenge not found/i)
  })

  it('does not update the DB counter when authentication fails', async () => {
    await callLoginStart()
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser as any)
    MOCK_VERIFY_AUTH.mockResolvedValueOnce({ verified: false })

    await supertest(app)
      .post('/auth/passkey/login/finish')
      .send({ email: LOGIN_EMAIL, response: { id: CRED_ID } })

    expect(prisma.passkey.update).not.toHaveBeenCalled()
  })
})
