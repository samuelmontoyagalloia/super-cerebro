import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import type { Profile } from 'passport-google-oauth20'

// Must mock prisma before passport config loads it
vi.mock('../../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import passport from 'passport'
import prisma from '../../lib/prisma.js'

const mockProfile: Partial<Profile> = {
  id: 'google-user-123',
  displayName: 'Test User',
  emails: [{ value: 'test@example.com', verified: true }],
  provider: 'google',
}

const existingUser = {
  id: 'db-user-1',
  email: 'test@example.com',
  googleId: 'google-user-123',
  name: 'Test User',
  createdAt: new Date(),
}

const createdUser = {
  id: 'db-user-2',
  email: 'new@example.com',
  googleId: 'google-new-456',
  name: 'New User',
  createdAt: new Date(),
}

// verify callback extracted from the registered strategy
type VerifyFn = (
  accessToken: string,
  refreshToken: string,
  profile: Profile,
  done: (err: Error | null, user?: unknown) => void
) => Promise<void>

let verify: VerifyFn

beforeAll(async () => {
  await import('../../config/passport.js')
  const strategy = (passport as any)._strategy('google')
  verify = strategy._verify.bind(strategy)
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Passport Google Strategy — verify callback', () => {
  describe('existing user', () => {
    it('finds user by googleId and returns it without creating', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser as any)
      const done = vi.fn()

      await verify('access-token', 'refresh-token', mockProfile as Profile, done)

      expect(prisma.user.findUnique).toHaveBeenCalledOnce()
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: 'google-user-123' },
      })
      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalledWith(null, existingUser)
    })
  })

  describe('new user', () => {
    it('creates user with googleId, email and displayName when not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser as any)

      const newProfile: Partial<Profile> = {
        ...mockProfile,
        id: 'google-new-456',
        displayName: 'New User',
        emails: [{ value: 'new@example.com', verified: true }],
      }
      const done = vi.fn()

      await verify('access-token', 'refresh-token', newProfile as Profile, done)

      expect(prisma.user.create).toHaveBeenCalledOnce()
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          googleId: 'google-new-456',
          email: 'new@example.com',
          name: 'New User',
        },
      })
      expect(done).toHaveBeenCalledWith(null, createdUser)
    })
  })

  describe('error cases', () => {
    it('calls done with error when profile has empty emails array', async () => {
      const profileNoEmail = { ...mockProfile, emails: [] }
      const done = vi.fn()

      await verify('access-token', 'refresh-token', profileNoEmail as Profile, done)

      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No email provided by Google' })
      )
    })

    it('calls done with error when profile emails is undefined', async () => {
      const profileNoEmail = { ...mockProfile, emails: undefined }
      const done = vi.fn()

      await verify('access-token', 'refresh-token', profileNoEmail as Profile, done)

      expect(done).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No email provided by Google' })
      )
    })

    it('calls done with error when findUnique throws', async () => {
      const dbError = new Error('Connection refused')
      vi.mocked(prisma.user.findUnique).mockRejectedValue(dbError)
      const done = vi.fn()

      await verify('access-token', 'refresh-token', mockProfile as Profile, done)

      expect(done).toHaveBeenCalledWith(dbError)
    })

    it('calls done with error when user creation throws', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      const createError = new Error('Unique constraint violation')
      vi.mocked(prisma.user.create).mockRejectedValue(createError)
      const done = vi.fn()

      await verify('access-token', 'refresh-token', mockProfile as Profile, done)

      expect(done).toHaveBeenCalledWith(createError)
    })
  })

  describe('email allowlist (ALLOWED_EMAIL)', () => {
    const ALLOWED = 'allowed@example.com'
    const BLOCKED = 'blocked@example.com'

    afterEach(() => {
      delete process.env.ALLOWED_EMAIL
    })

    it('rejects with done(null, false) when email does not match ALLOWED_EMAIL', async () => {
      process.env.ALLOWED_EMAIL = ALLOWED
      const blocked = { ...mockProfile, emails: [{ value: BLOCKED, verified: true }] }
      const done = vi.fn()

      await verify('a', 'r', blocked as Profile, done)

      expect(done).toHaveBeenCalledWith(null, false)
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('allows authentication and proceeds to DB when email matches ALLOWED_EMAIL', async () => {
      process.env.ALLOWED_EMAIL = ALLOWED
      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser as any)
      const allowed = { ...mockProfile, emails: [{ value: ALLOWED, verified: true }] }
      const done = vi.fn()

      await verify('a', 'r', allowed as Profile, done)

      expect(prisma.user.findUnique).toHaveBeenCalledOnce()
      expect(done).toHaveBeenCalledWith(null, existingUser)
    })

    it('allows any email when ALLOWED_EMAIL is not set', async () => {
      delete process.env.ALLOWED_EMAIL
      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser as any)
      const done = vi.fn()

      await verify('a', 'r', mockProfile as Profile, done)

      expect(done).toHaveBeenCalledWith(null, existingUser)
    })

    it('is case-sensitive: rejects an uppercase variant of the allowed email', async () => {
      process.env.ALLOWED_EMAIL = ALLOWED
      const upper = { ...mockProfile, emails: [{ value: ALLOWED.toUpperCase(), verified: true }] }
      const done = vi.fn()

      await verify('a', 'r', upper as Profile, done)

      expect(done).toHaveBeenCalledWith(null, false)
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })
  })
})
