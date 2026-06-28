import { useEffect, useState, useCallback } from 'react'
import { Send, Search, RotateCcw, MapPin, User, Image, MessageSquare, List, MousePointerClick, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { fmtDate } from '../lib/utils'
import { onSocket } from '../lib/socket'

const TYPES = ['text', 'media', 'location', 'contact', 'buttons', 'list']

export default function Messages() {
  const [devices, setDevices] = useState([])
  const [sendType, setSendType] = useState('text')
  const [form, setForm] = useState({})
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)

  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ deviceId: '', direction: '', status: '', type: '', search: '' })
  const [page, setPage] = useState(1)

  useEffect(() => {
    api
      .get('/devices', { params: { limit: 100 } })
      .then((r) => setDevices(r.data?.data || []))
      .catch(() => {})
  }, [])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/messages', { params: { ...cleanParams(filters), page, limit: 15 } })
      setRows(res.data?.data || [])
      setMeta(res.data?.meta || {})
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    const t = setTimeout(loadHistory, 250)
    return () => clearTimeout(t)
  }, [loadHistory])

  // Live status + incoming
  useEffect(() => {
    const offStatus = onSocket('message:status', (p) => {
      setRows((prev) => prev.map((m) => (m.id === p.id ? { ...m, status: p.status } : m)))
    })
    const offInc = onSocket('message:incoming', () => loadHistory())
    return () => {
      offStatus?.()
      offInc?.()
    }
  }, [loadHistory])

  const send = async (e) => {
    e.preventDefault()
    if (!form.deviceId) return toast.error('Select a device')
    if (!form.to) return toast.error('Recipient is required')
    setSending(true)
    try {
      let res
      if (sendType === 'text') {
        res = await api.post('/messages/send', {
          deviceId: form.deviceId,
          to: form.to,
          body: form.body,
        })
      } else if (sendType === 'media') {
        if (!file) throw { message: 'Choose a file' }
        const fd = new FormData()
        fd.append('file', file)
        fd.append('to', form.to)
        fd.append('type', form.mediaType || 'IMAGE')
        fd.append('caption', form.caption || '')
        fd.append('deviceId', form.deviceId)
        res = await api.post('/messages/send-media', fd)
      } else if (sendType === 'location') {
        res = await api.post('/messages/send-location', {
          deviceId: form.deviceId,
          to: form.to,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          name: form.name,
          address: form.address,
        })
      } else if (sendType === 'contact') {
        res = await api.post('/messages/send-contact', {
          deviceId: form.deviceId,
          to: form.to,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
        })
      } else if (sendType === 'buttons') {
        const buttons = (form.buttons || []).filter((b) => b?.text?.trim()).map((b) => ({ text: b.text }))
        if (!buttons.length) throw { message: 'Tambahkan minimal satu tombol' }
        res = await api.post('/messages/send-buttons', {
          deviceId: form.deviceId,
          to: form.to,
          body: form.body,
          footer: form.footer || undefined,
          buttons,
        })
      } else if (sendType === 'list') {
        const rowsData = (form.rows || []).filter((r) => r?.title?.trim()).map((r) => ({
          title: r.title,
          description: r.description || undefined,
        }))
        if (!rowsData.length) throw { message: 'Tambahkan minimal satu baris' }
        res = await api.post('/messages/send-list', {
          deviceId: form.deviceId,
          to: form.to,
          body: form.body,
          footer: form.footer || undefined,
          title: form.title || undefined,
          buttonText: form.buttonText || undefined,
          sections: [{ title: form.sectionTitle || undefined, rows: rowsData }],
        })
      }
      toast.success(res.data?.message || 'Message sent')
      setForm((f) => ({ deviceId: f.deviceId }))
      setFile(null)
      loadHistory()
    } catch (e) {
      toast.error(msgOf(e, 'Failed to send'))
    } finally {
      setSending(false)
    }
  }

  const resend = async (id) => {
    try {
      await api.post(`/messages/${id}/resend`)
      toast.success('Resend queued')
      loadHistory()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const columns = [
    {
      key: 'direction',
      header: 'Dir',
      render: (r) => <Badge tone={r.direction === 'INBOUND' ? 'blue' : 'gray'}>{r.direction}</Badge>,
    },
    { key: 'type', header: 'Type', render: (r) => <span className="text-xs">{r.type}</span> },
    {
      key: 'party',
      header: 'To / From',
      render: (r) => <span className="font-medium text-slate-700">{r.direction === 'INBOUND' ? r.from : r.to}</span>,
    },
    {
      key: 'body',
      header: 'Body',
      render: (r) => <span className="line-clamp-1 block max-w-xs text-slate-600">{r.body || '-'}</span>,
    },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    { key: 'device', header: 'Device', render: (r) => <span className="text-xs text-slate-500">{r.device?.name || '-'}</span> },
    { key: 'createdAt', header: 'Time', render: (r) => <span className="text-xs text-slate-500">{fmtDate(r.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        r.direction === 'OUTBOUND' && r.status === 'FAILED' ? (
          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => resend(r.id)}>
            <RotateCcw size={14} /> Resend
          </button>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader title="Messages" subtitle="Send messages and review history" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compose */}
        <form onSubmit={send} className="card space-y-4 p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-900">Compose</h3>

          <div>
            <label className="label">Device</label>
            <select
              className="input"
              value={form.deviceId || ''}
              onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
            >
              <option value="">Select device</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.phoneNumber ? `(${d.phoneNumber})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-6 gap-1 rounded-lg bg-slate-100 p-1">
              {TYPES.map((t) => {
                const Icon =
                  t === 'text' ? MessageSquare
                  : t === 'media' ? Image
                  : t === 'location' ? MapPin
                  : t === 'contact' ? User
                  : t === 'buttons' ? MousePointerClick
                  : List
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setSendType(t)}
                    className={
                      'flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium capitalize transition ' +
                      (sendType === t ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500')
                    }
                  >
                    <Icon size={14} />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Recipient (phone)</label>
            <input
              className="input"
              placeholder="6281234567890"
              value={form.to || ''}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
          </div>

          {sendType === 'text' && (
            <div>
              <label className="label">Message</label>
              <textarea
                className="input min-h-[100px]"
                value={form.body || ''}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Type your message..."
              />
            </div>
          )}

          {sendType === 'media' && (
            <>
              <div>
                <label className="label">Media type</label>
                <select
                  className="input"
                  value={form.mediaType || 'IMAGE'}
                  onChange={(e) => setForm({ ...form, mediaType: e.target.value })}
                >
                  {['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">File</label>
                <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="label">Caption</label>
                <input
                  className="input"
                  value={form.caption || ''}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                />
              </div>
            </>
          )}

          {sendType === 'location' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Latitude</label>
                  <input
                    className="input"
                    value={form.latitude || ''}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input
                    className="input"
                    value={form.longitude || ''}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Name</label>
                <input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Address</label>
                <input className="input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </>
          )}

          {sendType === 'contact' && (
            <>
              <div>
                <label className="label">Contact name</label>
                <input
                  className="input"
                  value={form.contactName || ''}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Contact phone</label>
                <input
                  className="input"
                  value={form.contactPhone || ''}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                />
              </div>
            </>
          )}

          {sendType === 'buttons' && (
            <>
              <div>
                <label className="label">Body</label>
                <textarea
                  className="input min-h-[80px]"
                  value={form.body || ''}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Pesan dengan tombol..."
                />
              </div>
              <div>
                <label className="label">Footer</label>
                <input className="input" value={form.footer || ''} onChange={(e) => setForm({ ...form, footer: e.target.value })} />
              </div>
              <div>
                <label className="label">Tombol (maks 3)</label>
                <div className="space-y-2">
                  {(form.buttons || []).map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="input"
                        placeholder={`Tombol ${i + 1}`}
                        value={b.text || ''}
                        onChange={(e) => {
                          const buttons = [...(form.buttons || [])]
                          buttons[i] = { ...buttons[i], text: e.target.value }
                          setForm({ ...form, buttons })
                        }}
                      />
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
                        onClick={() => setForm({ ...form, buttons: (form.buttons || []).filter((_, j) => j !== i) })}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  {(form.buttons || []).length < 3 && (
                    <button
                      type="button"
                      className="btn-secondary w-full text-xs"
                      onClick={() => setForm({ ...form, buttons: [...(form.buttons || []), { text: '' }] })}
                    >
                      <Plus size={14} /> Tambah tombol
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {sendType === 'list' && (
            <>
              <div>
                <label className="label">Body</label>
                <textarea
                  className="input min-h-[80px]"
                  value={form.body || ''}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Pesan dengan list..."
                />
              </div>
              <div>
                <label className="label">Footer</label>
                <input className="input" value={form.footer || ''} onChange={(e) => setForm({ ...form, footer: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Title</label>
                  <input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="label">Button text</label>
                  <input className="input" value={form.buttonText || ''} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Judul section</label>
                <input className="input" value={form.sectionTitle || ''} onChange={(e) => setForm({ ...form, sectionTitle: e.target.value })} />
              </div>
              <div>
                <label className="label">Baris</label>
                <div className="space-y-2">
                  {(form.rows || []).map((row, i) => (
                    <div key={i} className="space-y-1 rounded-lg border border-slate-200 p-2">
                      <div className="flex items-center gap-2">
                        <input
                          className="input"
                          placeholder={`Judul baris ${i + 1}`}
                          value={row.title || ''}
                          onChange={(e) => {
                            const rows = [...(form.rows || [])]
                            rows[i] = { ...rows[i], title: e.target.value }
                            setForm({ ...form, rows })
                          }}
                        />
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => setForm({ ...form, rows: (form.rows || []).filter((_, j) => j !== i) })}
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <input
                        className="input"
                        placeholder="Deskripsi (opsional)"
                        value={row.description || ''}
                        onChange={(e) => {
                          const rows = [...(form.rows || [])]
                          rows[i] = { ...rows[i], description: e.target.value }
                          setForm({ ...form, rows })
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary w-full text-xs"
                    onClick={() => setForm({ ...form, rows: [...(form.rows || []), { title: '', description: '' }] })}
                  >
                    <Plus size={14} /> Tambah baris
                  </button>
                </div>
              </div>
            </>
          )}

          <button type="submit" className="btn-primary w-full" disabled={sending}>
            {sending ? <Spinner size={16} /> : <><Send size={16} /> Send</>}
          </button>
        </form>

        {/* History */}
        <div className="lg:col-span-2">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="relative col-span-2 sm:col-span-1">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-8"
                placeholder="Search"
                value={filters.search}
                onChange={(e) => {
                  setPage(1)
                  setFilters({ ...filters, search: e.target.value })
                }}
              />
            </div>
            <select className="input" value={filters.deviceId} onChange={(e) => { setPage(1); setFilters({ ...filters, deviceId: e.target.value }) }}>
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select className="input" value={filters.direction} onChange={(e) => { setPage(1); setFilters({ ...filters, direction: e.target.value }) }}>
              <option value="">All directions</option>
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </select>
            <select className="input" value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }) }}>
              <option value="">All status</option>
              {['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="input" value={filters.type} onChange={(e) => { setPage(1); setFilters({ ...filters, type: e.target.value }) }}>
              <option value="">All types</option>
              {['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOCATION', 'CONTACT'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            empty={<EmptyState icon={MessageSquare} title="No messages" message="Sent and received messages will appear here." />}
          />
          <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}

function cleanParams(obj) {
  const out = {}
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== '' && v != null) out[k] = v
  })
  return out
}
