/**
 * Unit tests — Passport Google OAuth callbackURL configuration (src/config/passport.ts).
 *
 * Verifies the TUNNEL_URL → BACKEND_URL → fallback chain by reloading the
 * module with different env vars via vi.stubEnv + vi.resetModules.
 */

import { vi, describe, it, expect, afterEach } from 'vitest'

// ── Mocks (hoisted — apply to every dynamic import in this file) ───────────────

vi.mock('passport-google-oauth20', () => ({
  Strategy: vi.fn(),
}))

vi.mock('passport', () => ({
  default: { use: vi.fn(), initialize: vi.fn() },
}))

vi.mock('../../lib/prisma.js', () => ({
  default: { user: { findUnique: vi.fn() } },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function loadAndGetStrategy() {
  // Import passport-google-oauth20 FIRST so it's cached before passport.ts runs.
  // Both imports then share the same mock instance.
  const { Strategy } = await import('passport-google-oauth20')
  await import('../../config/passport.js')
  return vi.mocked(Strategy)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Passport — Google OAuth callbackURL', () => {
  it('uses TUNNEL_URL as callbackURL in dev when TUNNEL_URL is set', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('TUNNEL_URL', 'https://example-tunnel.use2.devtunnels.ms')
    vi.stubEnv('BACKEND_URL', 'http://localhost:3000')

    const Strategy = await loadAndGetStrategy()

    expect(Strategy).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: 'https://example-tunnel.use2.devtunnels.ms/auth/google/callback',
      }),
      expect.any(Function)
    )
  })

  it('uses BACKEND_URL in production even when TUNNEL_URL is set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TUNNEL_URL', 'https://example-tunnel.use2.devtunnels.ms')
    vi.stubEnv('BACKEND_URL', 'https://api.production.example.com')

    const Strategy = await loadAndGetStrategy()

    expect(Strategy).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: 'https://api.production.example.com/auth/google/callback',
      }),
      expect.any(Function)
    )
  })

  it('uses BACKEND_URL when TUNNEL_URL is empty (not set)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('TUNNEL_URL', '')               // empty string → falsy → falls through
    vi.stubEnv('BACKEND_URL', 'http://localhost:3000')

    const Strategy = await loadAndGetStrategy()

    expect(Strategy).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: 'http://localhost:3000/auth/google/callback',
      }),
      expect.any(Function)
    )
  })
})
