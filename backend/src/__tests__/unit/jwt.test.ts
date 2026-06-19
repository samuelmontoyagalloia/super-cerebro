import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET!
const USER_ID = 'unit-test-user-abc'

describe('JWT — token lifecycle', () => {
  it('sign produces a token with the userId payload', () => {
    const token = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: '7d' })
    const payload = jwt.verify(token, SECRET) as { userId: string }

    expect(payload.userId).toBe(USER_ID)
  })

  it('token expiry is exactly 7 days (604800 seconds)', () => {
    const token = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: '7d' })
    const { iat, exp } = jwt.decode(token) as { iat: number; exp: number }

    expect(exp - iat).toBe(7 * 24 * 60 * 60)
  })

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign({ userId: USER_ID }, 'completely-wrong-secret')

    expect(() => jwt.verify(token, SECRET)).toThrow(jwt.JsonWebTokenError)
  })

  it('rejects an already-expired token', () => {
    const token = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: '-1s' })

    expect(() => jwt.verify(token, SECRET)).toThrow(jwt.TokenExpiredError)
  })

  it('rejects a tampered payload', () => {
    const [header, , signature] = jwt
      .sign({ userId: USER_ID }, SECRET, { expiresIn: '7d' })
      .split('.')

    // swap the payload for a different user
    const fakePayload = Buffer.from(JSON.stringify({ userId: 'attacker' })).toString('base64url')
    const tamperedToken = `${header}.${fakePayload}.${signature}`

    expect(() => jwt.verify(tamperedToken, SECRET)).toThrow(jwt.JsonWebTokenError)
  })

  it('does not embed the secret in the token', () => {
    const token = jwt.sign({ userId: USER_ID }, SECRET, { expiresIn: '7d' })

    // JWT is base64url-encoded, not encrypted — verify the raw secret is absent
    expect(token).not.toContain(SECRET)
  })
})
