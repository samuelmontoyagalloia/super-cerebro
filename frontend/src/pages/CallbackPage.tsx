import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

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
      navigate('/dashboard', { replace: true })
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
