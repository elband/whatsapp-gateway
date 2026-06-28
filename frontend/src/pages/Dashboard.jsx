import { useEffect, useState, useCallback } from 'react'
import {
  Smartphone,
  Wifi,
  WifiOff,
  MessageSquare,
  Send,
  AlertTriangle,
  Inbox,
  Cpu,
  HardDrive,
  MemoryStick,
  Activity,
  Radio,
  ListChecks,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import api from '../lib/api'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { PageSpinner } from '../components/Spinner'
import { cn, fmtUptime, fmtBytes } from '../lib/utils'
import { onSocket } from '../lib/socket'

function Gauge({ label, percent, icon: Icon, sub }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  const tone = p > 85 ? 'bg-red-500' : p > 65 ? 'bg-amber-500' : 'bg-brand-500'
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <Icon size={18} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">{p.toFixed(0)}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${p}%` }} />
      </div>
      {sub && <p className="mt-1.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [system, setSystem] = useState(null)
  const [chart, setChart] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    try {
      const [d, c, a] = await Promise.all([
        api.get('/monitoring/dashboard'),
        api.get('/monitoring/chart', { params: { days: 7 } }),
        api.get('/monitoring/activity', { params: { limit: 15 } }),
      ])
      setStats(d.data?.data || {})
      setChart(c.data?.data || [])
      setActivity(a.data?.data || [])
    } catch {
      /* handled globally */
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSystem = useCallback(async () => {
    try {
      const res = await api.get('/monitoring/system')
      setSystem(res.data?.data || {})
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadDashboard()
    loadSystem()
    const dashTimer = setInterval(loadDashboard, 15000)
    const sysTimer = setInterval(loadSystem, 5000)
    return () => {
      clearInterval(dashTimer)
      clearInterval(sysTimer)
    }
  }, [loadDashboard, loadSystem])

  // Live activity bumps
  useEffect(() => {
    const offIncoming = onSocket('message:incoming', (m) => {
      setActivity((prev) =>
        [{ id: `inc-${Date.now()}`, type: 'message', level: 'INFO', message: `Incoming from ${m?.from || 'unknown'}`, createdAt: new Date().toISOString() }, ...prev].slice(0, 20)
      )
      setStats((s) => (s ? { ...s, incomingToday: (s.incomingToday || 0) + 1, todayMessages: (s.todayMessages || 0) + 1 } : s))
    })
    const offStatus = onSocket('device:status', () => loadDashboard())
    return () => {
      offIncoming?.()
      offStatus?.()
    }
  }, [loadDashboard])

  if (loading) return <PageSpinner />

  const s = stats || {}
  const q = s.queue || {}

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Realtime overview of your gateway" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Devices" value={s.totalDevices} icon={Smartphone} tone="slate" />
        <StatCard label="Online" value={s.onlineDevices} icon={Wifi} tone="brand" />
        <StatCard label="Offline" value={s.offlineDevices} icon={WifiOff} tone="red" />
        <StatCard label="Active Broadcasts" value={s.activeBroadcasts} icon={Radio} tone="purple" />
        <StatCard label="Messages Today" value={s.todayMessages} icon={MessageSquare} tone="blue" />
        <StatCard label="Sent Today" value={s.sentToday} icon={Send} tone="brand" />
        <StatCard label="Failed Today" value={s.failedToday} icon={AlertTriangle} tone="red" />
        <StatCard label="Incoming Today" value={s.incomingToday} icon={Inbox} tone="amber" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Messages — Last 7 days</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="sent" stroke="#25D366" fill="url(#gSent)" name="Sent" />
                <Area type="monotone" dataKey="incoming" stroke="#3b82f6" fill="url(#gInc)" name="Incoming" />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="url(#gFail)" name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Queue */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ListChecks size={16} /> Queue
          </h3>
          <ul className="space-y-3 text-sm">
            {[
              ['Waiting', q.waiting, 'text-amber-600'],
              ['Active', q.active, 'text-blue-600'],
              ['Delayed', q.delayed, 'text-slate-600'],
              ['Completed', q.completed, 'text-brand-600'],
              ['Failed', q.failed, 'text-red-600'],
            ].map(([k, v, c]) => (
              <li key={k} className="flex items-center justify-between">
                <span className="text-slate-500">{k}</span>
                <span className={cn('font-semibold', c)}>{v ?? 0}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">API Requests Today</span>
              <span className="font-semibold text-slate-900">{s.apiRequestsToday ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System + Activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Gauge
            label="CPU"
            percent={system?.cpu}
            icon={Cpu}
            sub={system?.cores ? `${system.cores} cores` : undefined}
          />
          <Gauge
            label="Memory"
            percent={system?.mem?.usedPercent}
            icon={MemoryStick}
            sub={
              system?.mem
                ? `${fmtBytes(system.mem.used)} / ${fmtBytes(system.mem.total)}`
                : undefined
            }
          />
          <Gauge
            label="Disk"
            percent={system?.disk?.usePercent}
            icon={HardDrive}
            sub={system?.disk ? `${system.disk.used} / ${system.disk.size}` : undefined}
          />
          <div className="card p-4 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>OS</span>
              <span className="font-medium text-slate-700">
                {system?.os ? `${system.os.distro} ${system.os.release}` : '-'}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Uptime</span>
              <span className="font-medium text-slate-700">{fmtUptime(system?.uptime)}</span>
            </div>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Activity size={16} /> Recent Activity
          </h3>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No recent activity</p>
          ) : (
            <ul className="max-h-96 space-y-3 overflow-y-auto">
              {activity.map((a, i) => (
                <li key={a.id || i} className="flex items-start gap-3 text-sm">
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                      a.level === 'ERROR'
                        ? 'bg-red-500'
                        : a.level === 'WARN' || a.level === 'WARNING'
                        ? 'bg-amber-500'
                        : 'bg-brand-500'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-700">{a.message || a.action || a.type}</p>
                    <p className="text-xs text-slate-400">
                      {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                      {a.type ? ` · ${a.type}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
