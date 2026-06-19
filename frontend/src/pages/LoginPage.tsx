import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { startAuthentication } from '@simplewebauthn/browser'

const BACKEND_URL = import.meta.env.VITE_TUNNEL_URL ?? import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

type Phase = 'idle' | 'loading'

export default function LoginPage() {
  const navigate = useNavigate()
  const [returning, setReturning] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')

  useEffect(() => {
    setReturning(
      localStorage.getItem('sc_returning') === 'true' ||
      localStorage.getItem('has_passkey') === 'true'
    )
    setIsMobile(/iPhone|iPad/.test(navigator.userAgent))
  }, [])

  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/google`
  }

  const handleBiometric = async () => {
    if (phase === 'loading') return
    setPhase('loading')

    try {
      const email = localStorage.getItem('user_email')
      if (!email) throw new Error('No email found')

      const optRes = await fetch(`${BACKEND_URL}/auth/passkey/login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!optRes.ok) throw new Error('login/start failed')
      const options = await optRes.json()

      const credential = await startAuthentication({ optionsJSON: options })

      const finishRes = await fetch(`${BACKEND_URL}/auth/passkey/login/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, response: credential }),
      })
      if (!finishRes.ok) throw new Error('login/finish failed')
      const { token } = await finishRes.json()

      localStorage.setItem('auth_token', token)
      navigate('/dashboard')
    } catch {
      setPhase('idle')
    }
  }

  const handleSwitchAccount = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('sc_returning')
    localStorage.removeItem('has_passkey')
    localStorage.removeItem('user_email')
    setReturning(false)
    setPhase('idle')
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
      background: '#111010',
      color: '#FDFCFA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"DM Sans", system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      <GlowBackgrounds />
      <NoiseTexture />
      <Wordmark />
      <PrivadoBadge />

      {returning ? (
        <ReturnState phase={phase} isMobile={isMobile} onBiometric={handleBiometric} onSwitchAccount={handleSwitchAccount} />
      ) : (
        <FirstAccessState onGoogleLogin={handleGoogleLogin} />
      )}

      <BottomPillars />
    </div>
  )
}

/* ─── Backgrounds ────────────────────────────────────────────── */
function GlowBackgrounds() {
  return (
    <>
      <div style={{
        position: 'absolute', top: '-22%', left: '50%', transform: 'translateX(-50%)',
        width: '760px', height: '760px',
        background: 'radial-gradient(circle, rgba(0,102,255,0.20) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-28%', right: '-14%',
        width: '520px', height: '520px',
        background: 'radial-gradient(circle, rgba(0,102,255,0.10) 0%, transparent 62%)',
        pointerEvents: 'none',
      }} />
    </>
  )
}

function NoiseTexture() {
  return (
    <div style={{
      position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  )
}

/* ─── Chrome (wordmark + badge) ──────────────────────────────── */
function Wordmark() {
  return (
    <div style={{ position: 'absolute', top: '32px', left: '36px', zIndex: 3 }}>
      <div style={{
        fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
        fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em', lineHeight: 1.0,
        display: 'inline-flex', flexDirection: 'column',
      }}>
        <span style={{ color: '#FDFCFA' }}>Samuel</span>
        <span style={{ color: '#3385FF' }}>Montoya</span>
      </div>
    </div>
  )
}

function PrivadoBadge() {
  return (
    <div style={{
      position: 'absolute', top: '34px', right: '36px',
      display: 'flex', alignItems: 'center', gap: '7px', zIndex: 3,
    }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0066FF', display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '9px', fontWeight: 500, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#7A7570' }}>Privado</span>
    </div>
  )
}

/* ─── State 1: First access ──────────────────────────────────── */
function FirstAccessState({ onGoogleLogin }: { onGoogleLogin: () => void }) {
  return (
    <div style={{
      position: 'relative', zIndex: 2,
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      width: '100%', maxWidth: '460px', padding: '0 24px',
      animation: 'scFade .7s ease both',
    }}>
      <span style={{
        fontFamily: '"DM Sans", sans-serif', fontSize: '10px', fontWeight: 500,
        letterSpacing: '0.36em', textTransform: 'uppercase', color: '#3385FF', marginBottom: '26px',
      }}>Portal personal</span>

      <h1 style={{
        fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 300,
        fontSize: 'clamp(40px, 6.5vw, 62px)', letterSpacing: '-0.02em', lineHeight: 1.0,
        margin: 0, color: '#FDFCFA',
      }}>
        Super<br /><span style={{ color: '#3385FF' }}>Cerebro</span>
      </h1>

      <p style={{
        fontFamily: '"DM Sans", sans-serif', fontWeight: 300, fontSize: '15px',
        lineHeight: 1.7, color: '#8C8780', margin: '22px 0 36px', maxWidth: '30ch',
      }}>
        Tu conocimiento, tu contenido, tu coaching.<br />
        <span style={{ color: '#FDFCFA' }}>Un único punto de entrada.</span>
      </p>

      <button
        className="google-btn"
        onClick={onGoogleLogin}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          width: '100%', maxWidth: '320px', padding: '15px 22px',
          background: '#FDFCFA', color: '#111010', border: 'none', borderRadius: '8px',
          cursor: 'pointer', fontFamily: '"DM Sans", sans-serif', fontWeight: 500, fontSize: '15px',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
        }}
      >
        <GoogleLogo />
        Continuar con Google
      </button>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '22px', color: '#6B6660' }}>
        <LockIcon />
        <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '11px', fontWeight: 300, lineHeight: 1.5 }}>
          Solo Samuel puede entrar. Sin registros, sin contraseñas.
        </span>
      </div>
    </div>
  )
}

/* ─── State 2: Return / biometric ────────────────────────────── */
function ReturnState({
  phase, isMobile, onBiometric, onSwitchAccount,
}: {
  phase: Phase
  isMobile: boolean
  onBiometric: () => void
  onSwitchAccount: () => void
}) {
  const bioLabel = isMobile ? 'Mírate para entrar con Face ID' : 'Toca para entrar con tu huella'

  return (
    <div style={{
      position: 'relative', zIndex: 2,
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      width: '100%', maxWidth: '460px', padding: '0 24px',
      animation: 'scFade .6s ease both',
    }}>
      {/* Profile photo */}
      <div style={{
        width: '86px', height: '86px', borderRadius: '50%',
        padding: '3px', background: '#0066FF', marginBottom: '22px', flexShrink: 0,
      }}>
        <img
          src="/PROFILE.jpg"
          alt="Samuel Montoya"
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: 300, color: '#8C8780' }}>
        Bienvenido de nuevo
      </span>

      <h2 style={{
        fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 700,
        fontSize: '34px', letterSpacing: '-0.02em', margin: '4px 0 34px', color: '#FDFCFA',
      }}>Samuel</h2>

      {/* Biometric button — UI only, WebAuthn pendiente */}
      <button
        onClick={onBiometric}
        aria-label={isMobile ? 'Mírate para entrar con Face ID' : 'Toca para entrar con tu huella'}
        style={{
          position: 'relative', width: '96px', height: '96px', borderRadius: '50%',
          background: 'rgba(0,102,255,0.08)', border: '1.5px solid #0066FF',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 160ms ease', outline: 'none',
        }}
        onMouseEnter={e => { if (phase === 'idle') (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,102,255,0.18)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,102,255,0.08)' }}
      >
        <span style={{
          position: 'absolute', inset: '-1.5px', borderRadius: '50%',
          border: '1.5px solid #0066FF',
          animation: 'scPulse 1.9s ease-out infinite',
          pointerEvents: 'none',
        }} />
        {phase === 'loading' ? (
          <span style={{
            width: '28px', height: '28px',
            border: '2.5px solid rgba(51,133,255,.3)', borderTopColor: '#3385FF',
            borderRadius: '50%', display: 'inline-block', animation: 'scSpin .7s linear infinite',
          }} />
        ) : isMobile ? (
          <FaceIdIcon />
        ) : (
          <FingerprintIcon />
        )}
      </button>

      <span style={{
        fontFamily: '"DM Sans", sans-serif', fontSize: '13px', fontWeight: 300,
        color: '#8C8780', marginTop: '20px', maxWidth: '26ch', lineHeight: 1.6,
      }}>
        {bioLabel}
      </span>

      <button
        onClick={onSwitchAccount}
        style={{
          marginTop: '28px', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: '"DM Sans", sans-serif', fontSize: '11px', fontWeight: 400,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B6660',
          transition: 'color 160ms ease', padding: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#FDFCFA')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6B6660')}
      >
        Usar otra cuenta
      </button>
    </div>
  )
}

/* ─── Bottom pillars ─────────────────────────────────────────── */
function BottomPillars() {
  const pillars = ['Espontáneo', 'Disciplinado', 'Con Fe', 'Libre'] as const
  return (
    <div style={{ position: 'absolute', bottom: '30px', left: 0, right: 0, zIndex: 2, display: 'flex', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '7px 14px' }}>
        {pillars.map((label, i) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontFamily: '"DM Sans", sans-serif', fontSize: '9px', fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#5A5650' }}>{label}</span>
            {i < pillars.length - 1 && <span style={{ color: '#0066FF', fontSize: '9px' }}>·</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── Icons ──────────────────────────────────────────────────── */
function FingerprintIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#3385FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
      <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/>
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
      <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
      <path d="M2 16h.01"/>
      <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
    </svg>
  )
}

function FaceIdIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#3385FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
      <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <path d="M9 9h.01"/>
      <path d="M15 9h.01"/>
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flex: 'none' }} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
