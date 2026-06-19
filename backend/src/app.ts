import express from 'express'
import passport from 'passport'
import './config/passport.js'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import passkeyRouter from './routes/passkey.js'

export function createApp() {
  const app = express()
  app.use(express.json())
  app.use(passport.initialize())
  app.use('/api/health', healthRouter)
  app.use('/auth', authRouter)
  app.use('/auth/passkey', passkeyRouter)
  return app
}
