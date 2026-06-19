import { Router, type Request, type Response } from 'express'
import passport from 'passport'
import jwt from 'jsonwebtoken'

const router = Router()

const frontendUrl = process.env.FRONTEND_URL ?? 'https://cerebro.samuelmontoya.com'

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
)

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${frontendUrl}/login?error=unauthorized`,
  }),
  (req: Request, res: Response) => {
    const { userId } = req.user!
    const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`)
  }
)

export default router
