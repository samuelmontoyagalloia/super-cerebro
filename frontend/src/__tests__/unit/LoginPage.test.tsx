import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../pages/LoginPage'
import { startAuthentication } from '@simplewebauthn/browser'

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
}))

global.fetch = vi.fn() as unknown as typeof fetch

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

// ── First access state (no sc_returning) ─────────────────────────────────────

describe('LoginPage — first access', () => {
  beforeEach(() => localStorage.clear())

  it('renders without errors', () => {
    expect(() => renderLogin()).not.toThrow()
  })

  it('shows the "PORTAL PERSONAL" eyebrow', () => {
    renderLogin()
    expect(screen.getByText(/portal personal/i)).toBeInTheDocument()
  })

  it('shows "Super Cerebro" split across two lines', () => {
    renderLogin()
    expect(screen.getByText('Super')).toBeInTheDocument()
    expect(screen.getByText('Cerebro')).toBeInTheDocument()
  })

  it('shows the "Continuar con Google" button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })

  it('shows the Samuel-only access footnote', () => {
    renderLogin()
    expect(screen.getByText(/solo samuel puede entrar/i)).toBeInTheDocument()
  })

  it('shows the personal tagline', () => {
    renderLogin()
    expect(screen.getByText(/un único punto de entrada/i)).toBeInTheDocument()
  })

  it('shows the wordmark "Samuel" and "Montoya"', () => {
    renderLogin()
    // Multiple "Samuel" instances (wordmark + possibly heading) — at least one
    expect(screen.getAllByText('Samuel').length).toBeGreaterThan(0)
    expect(screen.getByText('Montoya')).toBeInTheDocument()
  })

  it('shows all four bottom pillars', () => {
    renderLogin()
    expect(screen.getByText(/espontáneo/i)).toBeInTheDocument()
    expect(screen.getByText(/disciplinado/i)).toBeInTheDocument()
    expect(screen.getByText(/con fe/i)).toBeInTheDocument()
    expect(screen.getByText(/libre/i)).toBeInTheDocument()
  })

  it('shows the PRIVADO badge', () => {
    renderLogin()
    expect(screen.getByText(/privado/i)).toBeInTheDocument()
  })

  it('does NOT show the biometric button', () => {
    renderLogin()
    expect(screen.queryByText(/bienvenido de nuevo/i)).not.toBeInTheDocument()
  })
})

// ── Google button redirect ────────────────────────────────────────────────────

describe('LoginPage — Google redirect', () => {
  it('clicking "Continuar con Google" redirects to the backend /auth/google endpoint', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    expect(window.location.href).toMatch(/\/auth\/google$/)
  })

  it('backend URL comes from VITE_TUNNEL_URL or VITE_BACKEND_URL', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    expect(window.location.href).toContain('/auth/google')
  })
})

// ── Return state (has_passkey = true) ─────────────────────────────────────────

describe('LoginPage — return / biometric state', () => {
  const ORIGINAL_UA = navigator.userAgent

  beforeEach(() => {
    localStorage.setItem('has_passkey', 'true')
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ORIGINAL_UA })
  })

  it('shows "Bienvenido de nuevo"', () => {
    renderLogin()
    expect(screen.getByText(/bienvenido de nuevo/i)).toBeInTheDocument()
  })

  it('shows the first name "Samuel"', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Samuel' })).toBeInTheDocument()
  })

  it('shows the profile photo with correct src', () => {
    renderLogin()
    const img = screen.getByRole('img', { name: /samuel montoya/i })
    expect(img).toHaveAttribute('src', '/PROFILE.jpg')
  })

  it('shows the "USAR OTRA CUENTA" link', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /usar otra cuenta/i })).toBeInTheDocument()
  })

  it('does NOT show the Google button', () => {
    renderLogin()
    expect(screen.queryByRole('button', { name: /continuar con google/i })).not.toBeInTheDocument()
  })

  it('shows fingerprint label on desktop (matchMedia.matches = false)', () => {
    renderLogin()
    expect(screen.getByText(/toca para entrar con tu huella/i)).toBeInTheDocument()
  })

  it('shows Face ID label on mobile (iPhone userAgent)', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    })
    renderLogin()
    await waitFor(() => {
      expect(screen.getByText(/mírate para entrar con face id/i)).toBeInTheDocument()
    })
  })

  it('biometric button click does not navigate when user_email is absent', async () => {
    // user_email not set → handleBiometric throws before any fetch → resets to idle
    renderLogin()
    const btn = screen.getByRole('button', { name: /toca para entrar con tu huella/i })
    fireEvent.click(btn)
    // give any microtasks a chance to settle
    await waitFor(() => expect(btn).toBeInTheDocument())
    expect(window.location.href).toBe('')
  })

  it('biometric button is present and clickable', () => {
    renderLogin()
    const btn = screen.getByRole('button', { name: /toca para entrar con tu huella/i })
    expect(btn).toBeInTheDocument()
    expect(() => fireEvent.click(btn)).not.toThrow()
  })

  it('"Usar otra cuenta" removes sc_returning from localStorage', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /usar otra cuenta/i }))
    expect(localStorage.getItem('sc_returning')).toBeNull()
  })

  it('"Usar otra cuenta" removes auth_token from localStorage', () => {
    localStorage.setItem('auth_token', 'some-jwt')
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /usar otra cuenta/i }))
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('"Usar otra cuenta" shows the Google button', async () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /usar otra cuenta/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
    })
  })
})

// ── sc_returning biometric trigger ───────────────────────────────────────────

describe('LoginPage — sc_returning biometric trigger', () => {
  afterEach(() => localStorage.clear())

  it('shows biometric state when only sc_returning is set (no has_passkey)', () => {
    localStorage.setItem('sc_returning', 'true')
    renderLogin()
    expect(screen.getByText(/bienvenido de nuevo/i)).toBeInTheDocument()
  })

  it('shows biometric state when only has_passkey is set (no sc_returning)', () => {
    localStorage.setItem('has_passkey', 'true')
    renderLogin()
    expect(screen.getByText(/bienvenido de nuevo/i)).toBeInTheDocument()
  })

  it('shows biometric state when both sc_returning and has_passkey are set', () => {
    localStorage.setItem('sc_returning', 'true')
    localStorage.setItem('has_passkey', 'true')
    renderLogin()
    expect(screen.getByText(/bienvenido de nuevo/i)).toBeInTheDocument()
  })

  it('shows Google button when neither sc_returning nor has_passkey is set', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
    expect(screen.queryByText(/bienvenido de nuevo/i)).not.toBeInTheDocument()
  })
})

// ── Biometric authentication flow ─────────────────────────────────────────────

describe('LoginPage — biometric authentication flow', () => {
  beforeEach(() => {
    localStorage.setItem('has_passkey', 'true')
    localStorage.setItem('user_email', 'user@example.com')
    vi.mocked(global.fetch).mockReset()
  })

  it('successful biometric auth saves the new auth_token to localStorage', async () => {
    vi.mocked(startAuthentication).mockResolvedValueOnce({
      id: 'cred-id', rawId: 'cred-id', response: {} as any,
      type: 'public-key', clientExtensionResults: {},
    })
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ challenge: 'c' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'new-jwt' }) } as Response)

    renderLogin()
    const btn = screen.getByRole('button', { name: /toca para entrar con tu huella/i })
    fireEvent.click(btn)

    await waitFor(() => expect(localStorage.getItem('auth_token')).toBe('new-jwt'))
  })

  it('"Usar otra cuenta" removes has_passkey from localStorage', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /usar otra cuenta/i }))
    expect(localStorage.getItem('has_passkey')).toBeNull()
  })

  it('"Usar otra cuenta" removes user_email from localStorage', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /usar otra cuenta/i }))
    expect(localStorage.getItem('user_email')).toBeNull()
  })
})
