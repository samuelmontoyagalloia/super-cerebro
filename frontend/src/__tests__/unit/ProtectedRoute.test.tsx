import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'

function renderProtected(token: string | null) {
  if (token) {
    localStorage.setItem('auth_token', token)
  } else {
    localStorage.removeItem('auth_token')
  }

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>PROTECTED CONTENT</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// ── With valid token ──────────────────────────────────────────────────────────

describe('ProtectedRoute — with token', () => {
  beforeEach(() => localStorage.clear())

  it('renders children when auth_token is present', () => {
    renderProtected('valid-jwt-token')
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument()
  })

  it('does NOT redirect to /login when token exists', () => {
    renderProtected('valid-jwt-token')
    expect(screen.queryByText('LOGIN PAGE')).not.toBeInTheDocument()
  })
})

// ── Without token ─────────────────────────────────────────────────────────────

describe('ProtectedRoute — without token', () => {
  beforeEach(() => localStorage.clear())

  it('redirects to /login when auth_token is absent', () => {
    renderProtected(null)
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })

  it('does NOT render children when auth_token is absent', () => {
    renderProtected(null)
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument()
  })

  it('redirects to /login when auth_token is an empty string', () => {
    renderProtected('')
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })
})
