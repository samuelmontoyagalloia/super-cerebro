import express from 'express'
import passport from 'passport'
import './config/passport.js'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import passkeyRouter from './routes/passkey.js'
import { authenticate } from './middleware/authenticate.js'

const PUBLIC_PATHS: Array<{ method: string; path: string }> = [
  { method: 'GET',  path: '/api/health' },
  { method: 'GET',  path: '/auth/google' },
  { method: 'GET',  path: '/auth/google/callback' },
  { method: 'POST', path: '/auth/passkey/login/start' },
  { method: 'POST', path: '/auth/passkey/login/finish' },
]

export function createApp() {
  const app = express()

  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
    const allowed = [frontendUrl, 'https://cerebro.samuelmontoya.com']
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    if (req.method === 'OPTIONS') { res.status(204).end(); return }
    next()
  })

  app.use(express.json())
  app.use(passport.initialize())

  app.use((req, res, next) => {
    const isPublic = PUBLIC_PATHS.some((p) => p.method === req.method && req.path === p.path)
    if (isPublic) return next()
    return authenticate(req, res, next)
  })

  app.use('/api/health', healthRouter)
  app.use('/auth', authRouter)
  app.use('/auth/passkey', passkeyRouter)
  return app
}
