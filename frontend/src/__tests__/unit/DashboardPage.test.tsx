import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DashboardPage from '../../pages/DashboardPage'

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/login"     element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('DashboardPage — rendering', () => {
  it('renders without errors', () => {
    expect(() => renderDashboard()).not.toThrow()
  })

  it('shows the "Tu segundo cerebro" eyebrow', () => {
    renderDashboard()
    expect(screen.getByText(/tu segundo cerebro/i)).toBeInTheDocument()
  })

  it('shows "Bienvenido," in the heading', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/bienvenido/i)
  })

  it('shows "Samuel." in the heading', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/samuel/i)
  })

  it('shows the "En construcción" status badge', () => {
    renderDashboard()
    expect(screen.getByText(/en construcción/i)).toBeInTheDocument()
  })

  it('shows the card body text about the system being built', () => {
    renderDashboard()
    expect(screen.getByText(/todavía no hay nada que mostrarte/i)).toBeInTheDocument()
  })

  it('shows the italic "incluso cuando nadie mira" emphasis', () => {
    renderDashboard()
    expect(screen.getByText(/incluso cuando nadie mira/i)).toBeInTheDocument()
  })

  it('shows the "MVP · V0.1" version footer', () => {
    renderDashboard()
    expect(screen.getByText(/MVP/)).toBeInTheDocument()
  })

  it('shows the "Cerrar sesión" button', () => {
    renderDashboard()
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument()
  })

  it('shows the "PRIVADO" badge', () => {
    renderDashboard()
    expect(screen.getByText(/privado/i)).toBeInTheDocument()
  })

  it('shows the profile photo with correct alt and src', () => {
    renderDashboard()
    const img = screen.getByRole('img', { name: /samuel montoya/i })
    expect(img).toHaveAttribute('src', '/PROFILE.jpg')
  })

  it('shows the "Super Cerebro" wordmark', () => {
    renderDashboard()
    expect(screen.getByText('Super')).toBeInTheDocument()
    expect(screen.getByText('Cerebro')).toBeInTheDocument()
  })
})

// ── Logout ────────────────────────────────────────────────────────────────────

describe('DashboardPage — logout', () => {
  beforeEach(() => {
    localStorage.setItem('auth_token',   'test-jwt')
    localStorage.setItem('sc_returning', 'true')
    localStorage.setItem('has_passkey',  'true')
    localStorage.setItem('user_email',   'samuel@example.com')
  })

  it('removes auth_token from localStorage on logout', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('preserves sc_returning in localStorage on logout', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    expect(localStorage.getItem('sc_returning')).toBe('true')
  })

  it('preserves has_passkey in localStorage on logout', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    expect(localStorage.getItem('has_passkey')).toBe('true')
  })

  it('preserves user_email in localStorage on logout', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    expect(localStorage.getItem('user_email')).toBe('samuel@example.com')
  })

  it('navigates to /login after logout', async () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
    await waitFor(() => expect(screen.getByText('LOGIN')).toBeInTheDocument())
  })
})
