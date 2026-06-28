import { useEffect, useState, useCallback } from 'react'
import { ScrollText, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { fmtDate } from '../lib/utils'

const TYPES = ['', 'API', 'LOGIN', 'ERROR', 'BROADCAST', 'DEVICE', 'MESSAGE', 'WEBHOOK', 'CONTACT', 'TEMPLATE', 'SETTING', 'SYSTEM']
const LEVELS = ['', 'INFO', 'WARN', 'ERROR']

export default function Logs() {
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ type: '', level: '', search: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/logs', {
        params: {
          page, limit: 25,
          type: filters.type || undefined,
          level: filters.level || undefined,
          search: filters.search || undefined,
        },
      })
      setRows(res.data?.data || [])
      setMeta(res.data?.meta || { page: 1, totalPages: 1, total: 0 })
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const setF = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })) }

  const columns = [
    { key: 'createdAt', header: 'Time', render: (r) => <span className="whitespace-nowrap text-slate-500">{fmtDate(r.createdAt)}</span> },
    { key: 'type', header: 'Type', render: (r) => <Badge tone="blue">{r.type}</Badge> },
    { key: 'level', header: 'Level', render: (r) => <Badge status={r.level}>{r.level}</Badge> },
    { key: 'action', header: 'Action', render: (r) => <span className="font-medium text-slate-700">{r.action}</span> },
    { key: 'message', header: 'Message', render: (r) => <span className="line-clamp-1 block max-w-sm text-slate-600">{r.message || '-'}</span> },
    { key: 'user', header: 'User', render: (r) => <span className="text-slate-500">{r.user?.name || (r.apiKeyId ? 'API key' : '-')}</span> },
    { key: 'ip', header: 'IP', render: (r) => <span className="text-slate-400">{r.ip || '-'}</span> },
  ]

  return (
    <div>
      <PageHeader title="Logs" subtitle="Audit, API, login, error & system activity" />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="flex items-center gap-1 text-slate-400"><Filter size={16} /></div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={filters.type} onChange={(e) => setF('type', e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Level</label>
          <select className="input" value={filters.level} onChange={(e) => setF('level', e.target.value)}>
            {LEVELS.map((l) => <option key={l} value={l}>{l || 'All levels'}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="label">Search</label>
          <input className="input" placeholder="Search message/action..." value={filters.search} onChange={(e) => setF('search', e.target.value)} />
        </div>
      </div>

      <DataTable columns={columns} data={rows} loading={loading}
        empty={<EmptyState icon={ScrollText} title="No logs" message="Activity will appear here." />} />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
    </div>
  )
}
