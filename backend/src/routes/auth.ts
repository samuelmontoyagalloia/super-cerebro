import { Router, type Request, type Response } from 'express'
import passport from 'passport'
import jwt from 'jsonwebtoken'

const router = Router()

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
)

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/' }),
  (req: Request, res: Response) => {
    const user = req.user as { id: string }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://cerebro.samuelmontoya.com'
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`)
  }
)

export default router
