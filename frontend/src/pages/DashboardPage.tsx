import { useNavigate } from 'react-router-dom'

const BLUE = '#0066FF'
const BG = '#080b12'

export default function DashboardPage() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      color: '#FDFCFA',
      fontFamily: '"DM Sans", system-ui, sans-serif',
    }}>
      {/* blue radial glow */}
      <div style={{
        position: 'absolute',
        top: '-18%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '700px',
        height: '700px',
        background: 'radial-gradient(circle, rgba(0,102,255,0.18) 0%, transparent 62%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* ── Navbar ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 28px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        zIndex: 3,
      }}>
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: BLUE,
            display: 'inline-block',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '-0.01em',
            color: '#FDFCFA',
          }}>
            Super{' '}
            <span style={{ color: BLUE }}>Cerebro</span>
          </span>
        </div>

        {/* Right: PRIVADO badge + photo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            padding: '5px 10px',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}>Privado</span>
          </div>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            overflow: 'hidden',
            border: `2px solid rgba(0,102,255,0.45)`,
            flexShrink: 0,
          }}>
            <img
              src="/PROFILE.jpg"
              alt="Samuel Montoya"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Eyebrow */}
        <p style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.34em',
          textTransform: 'uppercase',
          color: BLUE,
          margin: '0 0 20px',
        }}>
          Tu segundo cerebro
        </p>

        {/* Heading */}
        <h1 style={{
          fontFamily: '"Bricolage Grotesque", sans-serif',
          fontWeight: 300,
          fontSize: 'clamp(44px, 7vw, 76px)',
          letterSpacing: '-0.025em',
          lineHeight: 1.08,
          margin: '0 0 44px',
          textAlign: 'center',
          color: '#FDFCFA',
        }}>
          Bienvenido,<br />
          <span style={{ color: BLUE }}>Samuel.</span>
        </h1>

        {/* Card */}
        <div style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '28px 32px',
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE, display: 'inline-block', flexShrink: 0 }} />
            <span style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: BLUE,
            }}>
              En construcción
            </span>
          </div>
          <p style={{
            fontFamily: '"Bricolage Grotesque", sans-serif',
            fontWeight: 400,
            fontSize: 17,
            color: '#FDFCFA',
            margin: '0 0 12px',
            lineHeight: 1.45,
          }}>
            Todavía no hay nada que mostrarte.
          </p>
          <p style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 13,
            fontWeight: 300,
            color: 'rgba(255,255,255,0.42)',
            margin: 0,
            lineHeight: 1.65,
          }}>
            Pero el sistema ya corre por dentro. Se construye en silencio —{' '}
            <strong style={{ fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>
              incluso cuando nadie mira.
            </strong>
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 28px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        zIndex: 3,
      }}>
        <span style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.22)',
        }}>
          MVP · V0.1
        </span>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.11)',
            borderRadius: 8,
            padding: '8px 14px',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 13,
            fontWeight: 400,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.09)'
            e.currentTarget.style.color = '#FDFCFA'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.11)'
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
      </footer>
    </div>
  )
}
