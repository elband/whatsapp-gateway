import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, KeyRound, RefreshCw, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { fmtDate } from '../lib/utils'

export default function ApiKeys() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState([])
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api-keys', { params: { limit: 100 } })
      setRows(res.data?.data || [])
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/devices', { params: { limit: 100 } }).then((r) => setDevices(r.data?.data || [])).catch(() => {})
  }, [])

  const remove = async (id) => {
    try {
      await api.delete(`/api-keys/${id}`)
      toast.success('API key deleted')
      load()
    } catch (e) { toast.error(msgOf(e)) }
  }
  const regenerate = async (id) => {
    try {
      const res = await api.post(`/api-keys/${id}/regenerate`)
      setNewKey(res.data?.data)
      load()
    } catch (e) { toast.error(msgOf(e)) }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'keyPrefix', header: 'Prefix', render: (r) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.keyPrefix}…</code> },
    { key: 'isActive', header: 'Status', render: (r) => <Badge tone={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Active' : 'Disabled'}</Badge> },
    { key: 'lastUsedAt', header: 'Last used', render: (r) => <span className="text-slate-500">{fmtDate(r.lastUsedAt)}</span> },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost px-2 py-1" title="Regenerate"
            onClick={() => setConfirm({ title: 'Regenerate key?', message: 'The old key will stop working immediately.', confirmText: 'Regenerate', onConfirm: () => regenerate(r.id) })}>
            <RefreshCw size={15} />
          </button>
          <button className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
            onClick={() => setConfirm({ title: 'Delete API key?', message: `Delete ${r.name}?`, confirmText: 'Delete', onConfirm: () => remove(r.id) })}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="API Keys" subtitle="Keys for external apps (ERP, Helpdesk, Monitoring…)"
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New API Key</button>} />

      <DataTable columns={columns} data={rows} loading={loading}
        empty={<EmptyState icon={KeyRound} title="No API keys" message="Create a key to let an app send messages." />} />

      <CreateModal open={creating} devices={devices} onClose={() => setCreating(false)}
        onCreated={(data) => { setCreating(false); setNewKey(data); load() }} />
      <ShowKeyModal data={newKey} onClose={() => setNewKey(null)} />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm}
        title={confirm?.title} message={confirm?.message} confirmText={confirm?.confirmText} />
    </div>
  )
}

function CreateModal({ open, devices, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', defaultDeviceId: '', rateLimit: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setForm({ name: '', defaultDeviceId: '', rateLimit: 0 }) }, [open])

  const save = async () => {
    if (!form.name?.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        defaultDeviceId: form.defaultDeviceId ? Number(form.defaultDeviceId) : undefined,
        rateLimit: Number(form.rateLimit) || undefined,
      }
      const res = await api.post('/api-keys', payload)
      toast.success('API key created')
      onCreated?.(res.data?.data)
    } catch (e) { toast.error(msgOf(e)) } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="New API Key"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner size={16} /> : 'Create'}</button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="label">App name *</label>
          <input className="input" placeholder="e.g. Helpdesk ERP" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Default device</label>
            <select className="input" value={form.defaultDeviceId} onChange={(e) => setForm({ ...form, defaultDeviceId: e.target.value })}>
              <option value="">(none)</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Rate limit (req/min, 0=default)</label>
            <input className="input" type="number" value={form.rateLimit} onChange={(e) => setForm({ ...form, rateLimit: e.target.value })} />
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ShowKeyModal({ data, onClose }) {
  const [copied, setCopied] = useState(false)
  const key = data?.key
  const copy = async () => {
    try { await navigator.clipboard.writeText(key); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  return (
    <Modal open={!!key} onClose={onClose} title="API Key Created"
      footer={<button className="btn-primary" onClick={onClose}>Done</button>}>
      <div className="space-y-3">
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 ring-1 ring-amber-200">
          Copy this key now — it will <b>not</b> be shown again.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-slate-900 px-3 py-2 text-xs text-emerald-300">{key}</code>
          <button className="btn-secondary px-3 py-2" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        </div>
        <p className="text-xs text-slate-500">Use header <code>X-API-Key: {key}</code></p>
      </div>
    </Modal>
  )
}
