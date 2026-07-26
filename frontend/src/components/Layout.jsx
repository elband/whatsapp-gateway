import { useEffect, useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Smartphone,
  MessageSquare,
  Send,
  Users,
  FileText,
  Inbox,
  Bot,
  Wrench,
  Webhook,
  ScrollText,
  UserCog,
  Shield,
  KeyRound,
  BookText,
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Wifi,
  WifiOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../store/auth'
import WaLogo from './WaLogo'
import api from '../lib/api'
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket'
import { cn } from '../lib/utils'

// `perm` (opsional) menyembunyikan item bila user tak punya permission tsb.
// Item khusus super_admin (Users/Roles/API Keys/Settings) otomatis tersembunyi
// untuk admin biasa karena role-nya tidak memuat permission tersebut.
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chats', label: 'Inbox', icon: Inbox },
  { to: '/devices', label: 'Devices', icon: Smartphone },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/broadcast', label: 'Broadcast', icon: Send },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/autoresponder', label: 'Autoresponder', icon: Bot },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/webhooks', label: 'Webhooks', icon: Webhook },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/users', label: 'Users', icon: UserCog, perm: 'user.read' },
  { to: '/roles', label: 'Roles', icon: Shield, perm: 'role.read' },
  { to: '/api-keys', label: 'API Keys', icon: KeyRound, perm: 'apikey.read' },
  { to: '/api-docs', label: 'API Docs', icon: BookText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, perm: 'setting.read' },
]

export default function Layout() {
  const navigate = useNavigate()
  const { user, logout, setUser, hasPermission } = useAuth()
  const navItems = NAV.filter((n) => !n.perm || hasPermission(n.perm))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [connected, setConnected] = useState(false)

  // Establish socket + connection indicator + global toasts
  useEffect(() => {
    const s = connectSocket()
    if (!s) return

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onIncoming = (m) => {
      toast(`New message from ${m?.from || 'unknown'}`, { icon: '💬' })
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('message:incoming', onIncoming)
    setConnected(s.connected)

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('message:incoming', onIncoming)
    }
  }, [])

  // Refresh profile (permissions) on mount
  useEffect(() => {
    let alive = true
    api
      .get('/auth/me')
      .then((res) => {
        if (alive && res.data?.data) setUser(res.data.data)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    disconnectSocket()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
            <WaLogo size={22} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">WhatsApp Gateway</p>
            <p className="text-[11px] text-slate-400">Enterprise</p>
          </div>
          <button
            className="ml-auto rounded p-1 text-slate-400 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="ml-auto flex items-center gap-4">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                connected ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600'
              )}
              title={connected ? 'Realtime connected' : 'Realtime disconnected'}
            >
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {connected ? 'Live' : 'Offline'}
            </div>

            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
                  {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium text-slate-800">{user?.name || 'User'}</p>
                  <p className="text-[11px] text-slate-400">{user?.role || ''}</p>
                </div>
                <ChevronDown size={16} className="text-slate-400" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                      <p className="truncate text-xs text-slate-400">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        navigate('/settings')
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <SettingsIcon size={16} /> Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
