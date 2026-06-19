/**
 * Integration tests — full auth flow rendered inside the real router tree.
 * These tests exercise multiple components working together (CallbackPage →
 * ProtectedRoute → DashboardPage → LoginPage) without any mocked modules.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage    from '../../pages/LoginPage'
import CallbackPage from '../../pages/CallbackPage'
import DashboardPage from '../../pages/DashboardPage'
import ProtectedRoute from '../../components/ProtectedRoute'

const FAKE_TOKEN = 'hdr.eyJ1c2VySWQiOiJpbnRlZ3JhdGlvbi11c2VyIn0.sig'

function renderApp(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/"              element={<Navigate to="/login" replace />} />
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

// ── Callback → Dashboard ──────────────────────────────────────────────────────

describe('Auth flow — callback stores token and unlocks dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'location', {
      configurable: true, writable: true,
      value: { href: '', search: `?token=${FAKE_TOKEN}`, assign: vi.fn(), replace: vi.fn() },
    })
  })

  it('callback saves auth_token and redirects to dashboard', async () => {
    renderApp(`/auth/callback?token=${FAKE_TOKEN}`)
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
    expect(localStorage.getItem('auth_token')).toBe(FAKE_TOKEN)
  })

  it('callback sets sc_returning flag', async () => {
    renderApp(`/auth/callback?token=${FAKE_TOKEN}`)
    await waitFor(() => screen.getByText('Dashboard'))
    expect(localStorage.getItem('sc_returning')).toBe('true')
  })
})

// ── Dashboard protected ───────────────────────────────────────────────────────

describe('Auth flow — ProtectedRoute guards the dashboard', () => {
  beforeEach(() => localStorage.clear())

  it('redirects /dashboard to /login when no token is stored', () => {
    renderApp('/dashboard')
    expect(screen.getByText(/portal personal/i)).toBeInTheDocument()
  })

  it('shows dashboard when token is present in localStorage', () => {
    localStorage.setItem('auth_token', FAKE_TOKEN)
    renderApp('/dashboard')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})

// ── Logout → biometric state ──────────────────────────────────────────────────

describe('Auth flow — logout retains returning-user state', () => {
  beforeEach(() => localStorage.clear())

  it('after logout auth_token is gone but sc_returning persists', async () => {
    localStorage.setItem('auth_token', FAKE_TOKEN)
    localStorage.setItem('sc_returning', 'true')

    renderApp('/dashboard')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()

    // Click logout
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBeNull()
    })
    expect(localStorage.getItem('sc_returning')).toBe('true')
  })

  it('after logout, /login shows the biometric state (not Google button)', async () => {
    localStorage.setItem('auth_token', FAKE_TOKEN)
    localStorage.setItem('sc_returning', 'true')
    localStorage.setItem('has_passkey', 'true')

    renderApp('/dashboard')
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))

    await waitFor(() => {
      // Redirects to /login with sc_returning still set → biometric state
      expect(screen.getByText(/bienvenido de nuevo/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /continuar con google/i })).not.toBeInTheDocument()
  })
})

// ── Switch account ────────────────────────────────────────────────────────────

describe('Auth flow — "Usar otra cuenta" full reset', () => {
  beforeEach(() => {
    localStorage.setItem('sc_returning', 'true')
    localStorage.setItem('has_passkey', 'true')
    localStorage.setItem('auth_token', FAKE_TOKEN)
  })

  it('clicking "Usar otra cuenta" shows Google button', async () => {
    renderApp('/login')
    await waitFor(() => screen.getByRole('button', { name: /usar otra cuenta/i }))

    fireEvent.click(screen.getByRole('button', { name: /usar otra cuenta/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
    )
  })

  it('after "Usar otra cuenta" localStorage is fully cleared', async () => {
    renderApp('/login')
    await waitFor(() => screen.getByRole('button', { name: /usar otra cuenta/i }))

    fireEvent.click(screen.getByRole('button', { name: /usar otra cuenta/i }))

    expect(localStorage.getItem('sc_returning')).toBeNull()
    expect(localStorage.getItem('auth_token')).toBeNull()
  })
})

// ── Root redirect ─────────────────────────────────────────────────────────────

describe('Auth flow — root redirect', () => {
  beforeEach(() => localStorage.clear())

  it('navigating to "/" lands on the login page', () => {
    renderApp('/')
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })
})

// ── Callback edge cases ───────────────────────────────────────────────────────

describe('Auth flow — callback edge cases', () => {
  beforeEach(() => localStorage.clear())

  it('callback with empty token redirects to /login', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true, writable: true,
      value: { href: '', search: '', assign: vi.fn(), replace: vi.fn() },
    })
    renderApp('/auth/callback')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
    )
  })

  it('callback does not overwrite an existing token if called twice (ref guard)', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    Object.defineProperty(window, 'location', {
      configurable: true, writable: true,
      value: { href: '', search: `?token=${FAKE_TOKEN}`, assign: vi.fn(), replace: vi.fn() },
    })
    renderApp(`/auth/callback?token=${FAKE_TOKEN}`)
    await waitFor(() => screen.getByText('Dashboard'))
    const authCalls = spy.mock.calls.filter(([k]) => k === 'auth_token')
    expect(authCalls).toHaveLength(1)
  })
})
