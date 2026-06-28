import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Eye, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g

export default function Templates() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/templates', { params: { search: search || undefined } })
      setRows(res.data?.data || [])
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const remove = async (id) => {
    try {
      await api.delete(`/templates/${id}`)
      toast.success('Template deleted')
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'type', header: 'Type', render: (r) => <Badge tone="blue">{r.type}</Badge> },
    { key: 'body', header: 'Body', render: (r) => <span className="line-clamp-1 block max-w-md text-slate-600">{r.body}</span> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost px-2 py-1" onClick={() => setPreviewing(r)}><Eye size={15} /></button>
          <button className="btn-ghost px-2 py-1" onClick={() => setEditing(r)}><Edit2 size={15} /></button>
          <button
            className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
            onClick={() => setConfirm({ title: 'Delete template?', message: `Delete ${r.name}?`, onConfirm: () => remove(r.id) })}
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
        title="Templates"
        subtitle="Reusable message templates with variables"
        actions={
          <button className="btn-primary" onClick={() => setEditing({})}>
            <Plus size={16} /> New Template
          </button>
        }
      />

      <div className="mb-4 max-w-xs">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        empty={<EmptyState icon={FileText} title="No templates" message="Create reusable templates with {{variables}}." />}
      />

      <TemplateModal template={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      <PreviewModal template={previewing} onClose={() => setPreviewing(null)} />

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

function TemplateModal({ template, onClose, onSaved }) {
  const open = !!template
  const isEdit = template && template.id
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!template) return
    setForm({
      name: template.name || '',
      type: template.type || 'TEXT',
      body: template.body || '',
      caption: template.caption || '',
      description: template.description || '',
    })
  }, [template])

  const save = async () => {
    if (!form.name?.trim() || !form.body?.trim()) return toast.error('Name and body are required')
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        type: form.type,
        body: form.body,
        caption: form.caption || undefined,
        description: form.description || undefined,
      }
      const res = isEdit ? await api.put(`/templates/${template.id}`, payload) : await api.post('/templates', payload)
      toast.success(res.data?.message || 'Saved')
      onSaved?.()
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setSaving(false)
    }
  }

  const vars = [...new Set([...(form.body || '').matchAll(VAR_RE)].map((m) => m[1]))]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Template' : 'New Template'}
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
            <label className="label">Type</label>
            <select className="input" value={form.type || 'TEXT'} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Body *</label>
          <textarea
            className="input min-h-[120px]"
            placeholder="Hi {{name}}, your order {{orderId}} is ready!"
            value={form.body || ''}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          {vars.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-xs text-slate-400">Variables:</span>
              {vars.map((v) => (
                <Badge key={v} tone="blue">{v}</Badge>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label">Caption</label>
          <input className="input" value={form.caption || ''} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </div>
    </Modal>
  )
}

function PreviewModal({ template, onClose }) {
  const open = !!template
  const [vars, setVars] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const varNames = template ? [...new Set([...(template.body || '').matchAll(VAR_RE)].map((m) => m[1]))] : []

  useEffect(() => {
    if (template) {
      setVars({})
      setResult(null)
    }
  }, [template])

  const preview = async () => {
    setLoading(true)
    try {
      const res = await api.post(`/templates/${template.id}/preview`, { variables: vars })
      setResult(res.data?.data || {})
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Preview — ${template?.name || ''}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={preview} disabled={loading}>
            {loading ? <Spinner size={16} /> : 'Render'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {varNames.length === 0 && <p className="text-sm text-slate-500">This template has no variables.</p>}
        {varNames.map((v) => (
          <div key={v}>
            <label className="label">{v}</label>
            <input
              className="input"
              value={vars[v] || ''}
              onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
            />
          </div>
        ))}
        {result && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold text-slate-500">Rendered body</p>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{result.body}</p>
            {result.caption && (
              <p className="mt-2 text-xs text-slate-500">Caption: {result.caption}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
