import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#0d0d14]">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>
      <p className="text-slate-400 text-sm">Sesión iniciada correctamente.</p>
      <button
        onClick={handleLogout}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
