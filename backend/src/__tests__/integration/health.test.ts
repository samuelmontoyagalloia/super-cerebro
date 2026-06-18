import { vi, describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import type { Express } from 'express'

// Prevent real DB connection and passport strategy registration
vi.mock('../../lib/prisma.js', () => ({ default: {} }))
vi.mock('../../config/passport.js', () => ({}))

let app: Express

beforeAll(async () => {
  const { createApp } = await import('../../app.js')
  app = createApp()
})

describe('GET /api/health', () => {
  it('responds 200 with { status: "ok" }', async () => {
    const res = await supertest(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('responds with Content-Type application/json', async () => {
    const res = await supertest(app).get('/api/health')

    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('returns 404 for unknown paths', async () => {
    const res = await supertest(app).get('/api/unknown')

    expect(res.status).toBe(404)
  })
})
