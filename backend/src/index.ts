import 'dotenv/config'
import express from 'express'
import passport from 'passport'
import './config/passport.js'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(passport.initialize())

app.use('/api/health', healthRouter)
app.use('/auth', authRouter)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
