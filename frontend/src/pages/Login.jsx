import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Loader2 } from 'lucide-react'
import WaLogo from '../components/WaLogo'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import { useAuth } from '../store/auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuth((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const from = location.state?.from?.pathname || '/dashboard'

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      const data = res.data?.data || {}
      login({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        permissions: data.user?.permissions,
      })
      toast.success(res.data?.message || 'Welcome back!')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(msgOf(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
            <WaLogo size={30} />
          </div>
          <h1 className="text-2xl font-bold text-white">WhatsApp Gateway</h1>
          <p className="text-sm text-slate-300">Enterprise Admin Dashboard</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Sign in</h2>
          <p className="mb-5 text-sm text-slate-500">Enter your credentials to continue</p>

          <div className="mb-4">
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                className="input pl-9"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                className="input pl-9"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} #Elektronika Bandara Aji Pangeran Tumenggung Pranoto
        </p>
      </div>
    </div>
  )
}
