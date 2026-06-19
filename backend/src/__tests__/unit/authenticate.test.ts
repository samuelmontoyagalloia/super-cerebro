import { describe, it, expect } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import { authenticate } from '../../middleware/authenticate.js'

const SECRET = process.env.JWT_SECRET!

function makeApp() {
  const app = express()
  app.get('/protected', authenticate, (_req, res) => {
    res.json({ userId: _req.user?.userId })
  })
  return app
}

const app = makeApp()
const VALID_JWT = jwt.sign({ userId: 'test-user' }, SECRET, { expiresIn: '1h' })

describe('authenticate middleware', () => {
  it('returns 401 { error: "No token provided" } when Authorization header is absent', async () => {
    const res = await supertest(app).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'No token provided' })
  })

  it('returns 401 { error: "No token provided" } when header lacks "Bearer " prefix', async () => {
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'No token provided' })
  })

  it('returns 401 { error: "Invalid token" } for a plain non-JWT string', async () => {
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'Invalid token' })
  })

  it('returns 401 { error: "Invalid token" } for a JWT signed with the wrong secret', async () => {
    const bad = jwt.sign({ userId: 'x' }, 'wrong-secret')
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${bad}`)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'Invalid token' })
  })

  it('returns 401 { error: "Invalid token" } for an expired JWT', async () => {
    const expired = jwt.sign({ userId: 'x' }, SECRET, { expiresIn: '-1s' })
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expired}`)
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ error: 'Invalid token' })
  })

  it('returns 401 for a JWT with a tampered payload', async () => {
    const [header, , sig] = VALID_JWT.split('.')
    const fakePayload = Buffer.from(JSON.stringify({ userId: 'attacker' })).toString('base64url')
    const tampered = `${header}.${fakePayload}.${sig}`
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tampered}`)
    expect(res.status).toBe(401)
  })

  it('calls next() and attaches req.user.userId when the JWT is valid', async () => {
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${VALID_JWT}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ userId: 'test-user' })
  })
})
