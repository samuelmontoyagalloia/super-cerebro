import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../../pages/LoginPage'

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
  it('clicking "Continuar con Google" sets window.location.href to backend /auth/google', () => {
    renderLogin()
    const btn = screen.getByRole('button', { name: /continuar con google/i })
    fireEvent.click(btn)
    expect(window.location.href).toBe('http://localhost:3000/auth/google')
  })

  it('uses the VITE_BACKEND_URL fallback (http://localhost:3000) in tests', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    expect(window.location.href).toContain('/auth/google')
  })
})

// ── Return state (sc_returning = true) ────────────────────────────────────────

describe('LoginPage — return / biometric state', () => {
  beforeEach(() => {
    localStorage.setItem('sc_returning', 'true')
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('shows Face ID label on mobile (matchMedia.matches = true)', async () => {
    vi.mocked(window.matchMedia).mockImplementationOnce((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    renderLogin()
    await waitFor(() => {
      expect(screen.getByText(/mírate para entrar con face id/i)).toBeInTheDocument()
    })
  })

  it('biometric button click does NOT navigate (WebAuthn pending)', async () => {
    vi.useFakeTimers()
    renderLogin()
    const btn = screen.getByRole('button', { name: /toca para entrar con tu huella/i })
    fireEvent.click(btn)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(window.location.href).toBe('')
  })

  it('biometric button does NOT navigate — WebAuthn pending', async () => {
    renderLogin()
    const btn = screen.getByRole('button', { name: /toca para entrar con tu huella/i })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(window.location.href).toBe('')
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
