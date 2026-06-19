import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import prisma from '../lib/prisma.js'

const IS_PROD = process.env.NODE_ENV === 'production'
const callbackBase =
  !IS_PROD && process.env.TUNNEL_URL
    ? process.env.TUNNEL_URL
    : (process.env.BACKEND_URL ?? 'http://localhost:3000')

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${callbackBase}/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value
        if (!email) return done(new Error('No email provided by Google'))

        const allowedEmail = process.env.ALLOWED_EMAIL
        if (allowedEmail && email !== allowedEmail) {
          return done(null, false)
        }

        let user = await prisma.user.findUnique({ where: { googleId: profile.id } })

        if (!user) {
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email,
              name: profile.displayName,
            },
          })
        }

        return done(null, user)
      } catch (err) {
        return done(err as Error)
      }
    }
  )
)

export default passport
