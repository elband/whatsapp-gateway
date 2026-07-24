import { useEffect, useState, useCallback } from 'react'
import { Send, Plus, Pause, Play, X, RotateCcw, Radio } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Spinner, { PageSpinner } from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { fmtDate } from '../lib/utils'
import { onSocket } from '../lib/socket'

export default function Broadcast() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/broadcasts', { params: { limit: 50 } })
      setList(res.data?.data || [])
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const offProgress = onSocket('broadcast:progress', (p) => {
      setList((prev) =>
        prev.map((b) =>
          b.id === p.id
            ? { ...b, sentCount: p.sentCount, failedCount: p.failedCount, total: p.total ?? b.total }
            : b
        )
      )
    })
    const offStatus = onSocket('broadcast:status', (p) => {
      setList((prev) => prev.map((b) => (b.id === p.id ? { ...b, status: p.status } : b)))
    })
    const offDone = onSocket('broadcast:completed', () => load())
    return () => {
      offProgress?.()
      offStatus?.()
      offDone?.()
    }
  }, [load])

  const action = async (id, type) => {
    try {
      await api.post(`/broadcasts/${id}/${type}`)
      toast.success(`${type} requested`)
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Broadcast"
        subtitle="Send bulk campaigns with rate limiting"
        actions={
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> New Broadcast
          </button>
        }
      />

      {loading ? (
        <PageSpinner />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No broadcasts yet"
          message="Create a campaign to message many contacts at once."
          action={
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> New Broadcast
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {list.map((b) => {
            const total = b.total || 0
            const done = (b.sentCount || 0) + (b.failedCount || 0)
            const pct = total ? Math.round((done / total) * 100) : 0
            return (
              <div key={b.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{b.name}</p>
                      <Badge status={b.status}>{b.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {b.device?.name || '-'} ·{' '}
                      {b.scheduledAt ? `Scheduled ${fmtDate(b.scheduledAt)}` : 'Immediate'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {b.status === 'RUNNING' && (
                      <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => action(b.id, 'pause')}>
                        <Pause size={14} /> Pause
                      </button>
                    )}
                    {b.status === 'PAUSED' && (
                      <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => action(b.id, 'resume')}>
                        <Play size={14} /> Resume
                      </button>
                    )}
                    {['RUNNING', 'PAUSED', 'SCHEDULED'].includes(b.status) && (
                      <button
                        className="btn-ghost px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        onClick={() =>
                          setConfirm({
                            title: 'Cancel broadcast?',
                            message: `Stop "${b.name}"?`,
                            confirmText: 'Cancel broadcast',
                            onConfirm: () => action(b.id, 'cancel'),
                          })
                        }
                      >
                        <X size={14} /> Cancel
                      </button>
                    )}
                    {['COMPLETED', 'FAILED', 'CANCELLED'].includes(b.status) && (b.failedCount > 0) && (
                      <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => action(b.id, 'retry')}>
                        <RotateCcw size={14} /> Retry failed
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>
                      {done} / {total} processed
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs">
                    <span className="text-brand-600">Sent: {b.sentCount || 0}</span>
                    <span className="text-red-600">Failed: {b.failedCount || 0}</span>
                    <span className="text-slate-500">Total: {total}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateBroadcastModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={load} />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
      />
    </div>
  )
}

function CreateBroadcastModal({ open, onClose, onSaved }) {
  const [devices, setDevices] = useState([])
  const [templates, setTemplates] = useState([])
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)
  const [recipientMode, setRecipientMode] = useState('manual')
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({
    name: '',
    deviceId: '',
    messageType: 'TEXT',
    body: '',
    caption: '',
    minDelayMs: 3000,
    maxDelayMs: 8000,
    batchSize: 30,
    batchRestMinMs: 180000,
    batchRestMaxMs: 600000,
    scheduledAt: '',
    recipientsText: '',
    contactGroupId: '',
    templateId: '',
  })

  useEffect(() => {
    if (!open) return
    setFile(null)
    setRecipientMode('manual')
    setForm((f) => ({ ...f, name: '', body: '', recipientsText: '', contactGroupId: '' }))
    Promise.all([
      api.get('/devices', { params: { limit: 100 } }),
      api.get('/templates'),
      api.get('/contacts/groups'),
    ])
      .then(([d, t, g]) => {
        setDevices(d.data?.data || [])
        setTemplates(t.data?.data || [])
        setGroups(g.data?.data || [])
      })
      .catch(() => {})
  }, [open])

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    if (!form.deviceId) return toast.error('Select a device')
    setSaving(true)
    try {
      const recipients =
        recipientMode === 'manual'
          ? form.recipientsText
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .map((line) => {
                const [phone, name] = line.split(',').map((x) => x?.trim())
                return { phone, name: name || undefined, variables: {} }
              })
          : undefined

      let res
      if (file) {
        const fd = new FormData()
        fd.append('name', form.name)
        fd.append('deviceId', form.deviceId)
        fd.append('messageType', form.messageType)
        fd.append('body', form.body)
        if (form.caption) fd.append('caption', form.caption)
        fd.append('minDelayMs', form.minDelayMs)
        fd.append('maxDelayMs', form.maxDelayMs)
        fd.append('batchSize', form.batchSize)
        fd.append('batchRestMinMs', form.batchRestMinMs)
        fd.append('batchRestMaxMs', form.batchRestMaxMs)
        if (form.scheduledAt) fd.append('scheduledAt', new Date(form.scheduledAt).toISOString())
        if (form.templateId) fd.append('templateId', form.templateId)
        if (recipientMode === 'group' && form.contactGroupId) fd.append('contactGroupId', form.contactGroupId)
        if (recipients) fd.append('recipients', JSON.stringify(recipients))
        fd.append('file', file)
        res = await api.post('/broadcasts', fd)
      } else {
        res = await api.post('/broadcasts', {
          name: form.name,
          deviceId: form.deviceId,
          templateId: form.templateId || undefined,
          messageType: form.messageType,
          body: form.body,
          caption: form.caption || undefined,
          minDelayMs: Number(form.minDelayMs),
          maxDelayMs: Number(form.maxDelayMs),
          batchSize: Number(form.batchSize),
          batchRestMinMs: Number(form.batchRestMinMs),
          batchRestMaxMs: Number(form.batchRestMaxMs),
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
          recipients: recipientMode === 'manual' ? recipients : undefined,
          contactGroupId: recipientMode === 'group' ? form.contactGroupId || undefined : undefined,
        })
      }
      toast.success(res.data?.message || 'Broadcast created')
      onSaved?.()
      onClose?.()
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
      title="New Broadcast"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner size={16} /> : <><Send size={16} /> Create</>}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Device *</label>
          <select className="input" value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
            <option value="">Select device</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Template (optional)</label>
          <select
            className="input"
            value={form.templateId}
            onChange={(e) => {
              const tpl = templates.find((t) => t.id === e.target.value)
              setForm({ ...form, templateId: e.target.value, body: tpl?.body ?? form.body, messageType: tpl?.type ?? form.messageType })
            }}
          >
            <option value="">None</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Message type</label>
          <select className="input" value={form.messageType} onChange={(e) => setForm({ ...form, messageType: e.target.value })}>
            {['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Body</label>
          <textarea
            className="input min-h-[90px]"
            placeholder="Hello {{name}}, ..."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>
        {form.messageType !== 'TEXT' && (
          <>
            <div>
              <label className="label">Media file</label>
              <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="label">Caption</label>
              <input className="input" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            </div>
          </>
        )}

        <div>
          <label className="label">Min delay (ms)</label>
          <input type="number" className="input" value={form.minDelayMs} onChange={(e) => setForm({ ...form, minDelayMs: e.target.value })} />
        </div>
        <div>
          <label className="label">Max delay (ms)</label>
          <input type="number" className="input" value={form.maxDelayMs} onChange={(e) => setForm({ ...form, maxDelayMs: e.target.value })} />
        </div>

        <div className="sm:col-span-2 mt-1 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold text-slate-700">Anti-ban: istirahat per-batch</p>
          <p className="text-xs text-slate-400">Setiap sejumlah pesan, broadcast berhenti sejenak sebelum lanjut — meniru pola manusia agar nomor lebih aman.</p>
        </div>
        <div>
          <label className="label">Ukuran batch (pesan)</label>
          <input type="number" min="0" className="input" value={form.batchSize} onChange={(e) => setForm({ ...form, batchSize: e.target.value })} />
          <p className="mt-1 text-xs text-slate-400">0 = matikan istirahat batch</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Istirahat min (ms)</label>
            <input type="number" min="0" className="input" value={form.batchRestMinMs} onChange={(e) => setForm({ ...form, batchRestMinMs: e.target.value })} />
            <p className="mt-1 text-xs text-slate-400">≈ {(Number(form.batchRestMinMs) / 60000 || 0).toFixed(1)} mnt</p>
          </div>
          <div>
            <label className="label">Istirahat maks (ms)</label>
            <input type="number" min="0" className="input" value={form.batchRestMaxMs} onChange={(e) => setForm({ ...form, batchRestMaxMs: e.target.value })} />
            <p className="mt-1 text-xs text-slate-400">≈ {(Number(form.batchRestMaxMs) / 60000 || 0).toFixed(1)} mnt</p>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Schedule (optional)</label>
          <input
            type="datetime-local"
            className="input"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Recipients</label>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              className={recipientMode === 'manual' ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-secondary px-3 py-1.5 text-xs'}
              onClick={() => setRecipientMode('manual')}
            >
              Manual
            </button>
            <button
              type="button"
              className={recipientMode === 'group' ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-secondary px-3 py-1.5 text-xs'}
              onClick={() => setRecipientMode('group')}
            >
              Contact group
            </button>
          </div>
          {recipientMode === 'manual' ? (
            <textarea
              className="input min-h-[90px] font-mono text-xs"
              placeholder={'One per line: phone,name\n6281234567890,John\n6289876543210,Jane'}
              value={form.recipientsText}
              onChange={(e) => setForm({ ...form, recipientsText: e.target.value })}
            />
          ) : (
            <select className="input" value={form.contactGroupId} onChange={(e) => setForm({ ...form, contactGroupId: e.target.value })}>
              <option value="">Select group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.count != null ? `(${g.count})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </Modal>
  )
}
