import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { startRegistration } from '@simplewebauthn/browser'

const BACKEND_URL = import.meta.env.VITE_TUNNEL_URL ?? import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

async function registerPasskey(token: string): Promise<void> {
  const optRes = await fetch(`${BACKEND_URL}/auth/passkey/register/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!optRes.ok) throw new Error('register/start failed')
  const options = await optRes.json()

  if (options.user?.name) {
    localStorage.setItem('user_email', options.user.name)
  }

  const credential = await startRegistration({ optionsJSON: options })

  const finishRes = await fetch(`${BACKEND_URL}/auth/passkey/register/finish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(credential),
  })
  if (!finishRes.ok) throw new Error('register/finish failed')
  const result = await finishRes.json()

  if (result.success) {
    localStorage.setItem('has_passkey', 'true')
  }
}

export default function CallbackPage() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (token) {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('sc_returning', 'true')
      registerPasskey(token)
        .catch(() => {})
        .finally(() => navigate('/dashboard', { replace: true }))
    } else {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#111010',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '2px solid #0066FF',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'scSpin .7s linear infinite',
        }} />
        <p style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: '13px',
          fontWeight: 300,
          color: '#7A7570',
          margin: 0,
        }}>Iniciando sesión…</p>
      </div>
    </div>
  )
}
