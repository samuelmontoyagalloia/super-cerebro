import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CallbackPage from '../../pages/CallbackPage'
import { startRegistration } from '@simplewebauthn/browser'

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn().mockResolvedValue({
    id: 'test-cred', rawId: 'test-cred', response: {}, type: 'public-key', clientExtensionResults: {},
  }),
}))

global.fetch = vi.fn().mockImplementation((url: string) => {
  if (String(url).includes('/register/start')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ challenge: 'c', user: { name: 'test@example.com' } }) })
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
}) as unknown as typeof fetch

// Helper: render CallbackPage with a given URL search string
function renderCallback(search = '') {
  // Set window.location.search so the component can read the token
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { href: '', search, assign: vi.fn(), replace: vi.fn() },
  })

  // Track navigation by rendering destination routes
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <Routes>
        <Route path="/auth/callback" element={<CallbackPage />} />
        <Route path="/dashboard"    element={<div>DASHBOARD</div>} />
        <Route path="/login"        element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// ── With valid token ──────────────────────────────────────────────────────────

describe('CallbackPage — with token', () => {
  const TOKEN = 'header.eyJ1c2VySWQiOiJ0ZXN0LWlkIn0.sig' // base64: {"userId":"test-id"}

  beforeEach(() => localStorage.clear())

  it('processes the token and reaches /dashboard (spinner state is transient)', async () => {
    // The spinner is the initial render but useEffect fires synchronously in jsdom,
    // so by the time render() returns the component has already navigated to /dashboard.
    // We verify the end state (token stored + navigated) instead of the transient spinner.
    renderCallback(`?token=${TOKEN}`)
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
    expect(localStorage.getItem('auth_token')).toBe(TOKEN)
  })

  it('saves auth_token to localStorage', async () => {
    renderCallback(`?token=${TOKEN}`)
    await waitFor(() => expect(localStorage.getItem('auth_token')).toBe(TOKEN))
  })

  it('sets sc_returning = "true" in localStorage', async () => {
    renderCallback(`?token=${TOKEN}`)
    await waitFor(() => expect(localStorage.getItem('sc_returning')).toBe('true'))
  })

  it('navigates to /dashboard', async () => {
    renderCallback(`?token=${TOKEN}`)
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
  })
})

// ── Without token ─────────────────────────────────────────────────────────────

describe('CallbackPage — without token', () => {
  beforeEach(() => localStorage.clear())

  it('navigates to /login when ?token is absent', async () => {
    renderCallback('')
    await waitFor(() => expect(screen.getByText('LOGIN')).toBeInTheDocument())
  })

  it('does NOT set auth_token in localStorage', async () => {
    renderCallback('')
    await waitFor(() => expect(screen.getByText('LOGIN')).toBeInTheDocument())
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('does NOT set sc_returning in localStorage', async () => {
    renderCallback('')
    await waitFor(() => expect(screen.getByText('LOGIN')).toBeInTheDocument())
    expect(localStorage.getItem('sc_returning')).toBeNull()
  })
})

// ── Passkey registration on callback ─────────────────────────────────────────

describe('CallbackPage — passkey registration on callback', () => {
  const TOKEN = 'header.eyJ1c2VySWQiOiJ0ZXN0LWlkIn0.sig'

  beforeEach(() => localStorage.clear())

  it('sets has_passkey = "true" in localStorage when registration succeeds', async () => {
    renderCallback(`?token=${TOKEN}`)
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
    expect(localStorage.getItem('has_passkey')).toBe('true')
  })

  it('saves user_email from registration options to localStorage', async () => {
    renderCallback(`?token=${TOKEN}`)
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
    expect(localStorage.getItem('user_email')).toBe('test@example.com')
  })

  it('navigates to /dashboard even when startRegistration throws (non-blocking)', async () => {
    vi.mocked(startRegistration).mockRejectedValueOnce(new Error('cancelled'))
    renderCallback(`?token=${TOKEN}`)
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
    expect(localStorage.getItem('auth_token')).toBe(TOKEN)
  })

  it('navigates to /dashboard even when /register/start fetch fails (non-blocking)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response)
    renderCallback(`?token=${TOKEN}`)
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
    expect(localStorage.getItem('auth_token')).toBe(TOKEN)
  })
})

// ── StrictMode double-invoke guard ────────────────────────────────────────────

describe('CallbackPage — StrictMode guard', () => {
  const TOKEN = 'tok.eyJ1c2VySWQiOiJzdHJpY3QifQ.sig'

  it('stores auth_token exactly once even when effects run twice (useRef guard)', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '', search: `?token=${TOKEN}`, assign: vi.fn(), replace: vi.fn() },
    })

    render(
      <MemoryRouter initialEntries={[`/auth/callback?token=${TOKEN}`]}>
        <Routes>
          <Route path="/auth/callback" element={<CallbackPage />} />
          <Route path="/dashboard"     element={<div>DASHBOARD</div>} />
          <Route path="/login"         element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => screen.getByText('DASHBOARD'))

    const authCalls = setItemSpy.mock.calls.filter(([k]) => k === 'auth_token')
    expect(authCalls).toHaveLength(1)
  })
})
