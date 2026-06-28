import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Bot } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'

const MATCH_TYPES = ['EXACT', 'CONTAINS', 'STARTS_WITH', 'REGEX']

export default function Autoresponder() {
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/autoresponders', {
        params: { search: search || undefined, page, limit: 15 },
      })
      setRows(res.data?.data || [])
      setMeta(res.data?.meta || {})
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const remove = async (id) => {
    try {
      await api.delete(`/autoresponders/${id}`)
      toast.success('Autoresponder deleted')
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'keyword', header: 'Keyword', render: (r) => <span className="text-slate-600">{r.keyword}</span> },
    { key: 'matchType', header: 'Match', render: (r) => <Badge tone="blue">{r.matchType}</Badge> },
    {
      key: 'scope',
      header: 'Scope',
      render: (r) => <span className="text-xs text-slate-500">{r.device?.name || 'Semua device'}</span>,
    },
    { key: 'priority', header: 'Priority', render: (r) => <span className="text-slate-600">{r.priority}</span> },
    { key: 'hitCount', header: 'Hits', render: (r) => <span className="text-slate-600">{r.hitCount}</span> },
    {
      key: 'isActive',
      header: 'Status',
      render: (r) => <Badge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost px-2 py-1" onClick={() => setEditing(r)}><Edit2 size={15} /></button>
          <button
            className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
            onClick={() => setConfirm({ title: 'Delete autoresponder?', message: `Delete ${r.name}?`, onConfirm: () => remove(r.id) })}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Autoresponder"
        subtitle="Balas pesan masuk otomatis berdasarkan kata kunci"
        actions={
          <button className="btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> New Autoresponder
          </button>
        }
      />

      <div className="mb-4 max-w-xs">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search autoresponders..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        empty={<EmptyState icon={Bot} title="No autoresponders" message="Buat balasan otomatis berdasarkan kata kunci." />}
      />
      <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />

      <AutoresponderModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmText="Delete"
      />
    </div>
  )
}

function AutoresponderModal({ item, onClose, onSaved }) {
  const open = !!item
  const isEdit = item && item.id
  const [form, setForm] = useState({})
  const [devices, setDevices] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item) return
    setForm({
      name: item.name || '',
      deviceId: item.deviceId || '',
      keyword: item.keyword || '',
      matchType: item.matchType || 'CONTAINS',
      response: item.response || '',
      priority: item.priority ?? 0,
      isActive: item.isActive ?? true,
    })
    api
      .get('/devices', { params: { limit: 100 } })
      .then((r) => setDevices(r.data?.data || []))
      .catch(() => {})
  }, [item])

  const save = async () => {
    if (!form.name?.trim()) return toast.error('Name is required')
    if (!form.keyword?.trim()) return toast.error('Keyword is required')
    if (!form.response?.trim()) return toast.error('Response is required')
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        deviceId: form.deviceId ? Number(form.deviceId) : null,
        keyword: form.keyword,
        matchType: form.matchType,
        response: form.response,
        priority: Number(form.priority) || 0,
        isActive: !!form.isActive,
      }
      const res = isEdit
        ? await api.put(`/autoresponders/${item.id}`, payload)
        : await api.post('/autoresponders', payload)
      toast.success(res.data?.message || 'Saved')
      onSaved?.()
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Autoresponder' : 'New Autoresponder'}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner size={16} /> : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Device</label>
            <select className="input" value={form.deviceId || ''} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
              <option value="">Semua device</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Keyword *</label>
            <input className="input" value={form.keyword || ''} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
          </div>
          <div>
            <label className="label">Match Type</label>
            <select className="input" value={form.matchType || 'CONTAINS'} onChange={(e) => setForm({ ...form, matchType: e.target.value })}>
              {MATCH_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Response *</label>
          <textarea
            className="input min-h-[120px]"
            placeholder="Halo {{nama}}, terima kasih sudah menghubungi kami."
            value={form.response || ''}
            onChange={(e) => setForm({ ...form, response: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">Bisa pakai variabel {'{{nama}}'} dan {'{{nomor}}'}.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Priority</label>
            <input
              type="number"
              className="input"
              value={form.priority ?? 0}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Aktif
          </label>
        </div>
      </div>
    </Modal>
  )
}
