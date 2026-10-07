import { useEffect, useState, useCallback } from 'react'
import {
  Smartphone,
  Plus,
  QrCode,
  Power,
  RefreshCw,
  LogOut,
  Trash2,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Spinner, { PageSpinner } from '../components/Spinner'
import { onSocket } from '../lib/socket'

// Tier harian penerima unik per device (meniru tier portofolio Meta); 0 = tanpa batas.
const DAILY_TIERS = [250, 2000, 10000, 100000, 0]
import { fmtDate } from '../lib/utils'
import { useAuth } from '../store/auth'

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [qrDevice, setQrDevice] = useState(null)
  const [users, setUsers] = useState([])
  const isSuperAdmin = useAuth((s) => s.isSuperAdmin())

  const load = useCallback(async () => {
    try {
      const res = await api.get('/devices', { params: { search, limit: 100 } })
      setDevices(res.data?.data || [])
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

  // Super admin: ambil daftar user untuk dropdown reassign kepemilikan.
  useEffect(() => {
    if (!isSuperAdmin) return
    api.get('/users', { params: { limit: 200 } })
      .then((r) => setUsers(r.data?.data || []))
      .catch(() => {})
  }, [isSuperAdmin])

  const reassign = async (id, ownerId) => {
    if (!ownerId) return
    try {
      await api.patch(`/devices/${id}/owner`, { ownerId: Number(ownerId) })
      toast.success('Kepemilikan device dipindahkan')
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const setDailyLimit = async (id, limit) => {
    try {
      await api.put(`/devices/${id}`, { dailyRecipientLimit: Number(limit) })
      toast.success('Batas harian device diperbarui')
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  // Live status updates
  useEffect(() => {
    const off = onSocket('device:status', (p) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === p.id || d.deviceId === p.deviceId
            ? { ...d, status: p.status, phoneNumber: p.phoneNumber ?? d.phoneNumber, connected: p.status === 'CONNECTED' }
            : d
        )
      )
    })
    return () => off?.()
  }, [])

  const action = async (id, type, label) => {
    try {
      await api.post(`/devices/${id}/${type}`)
      toast.success(`${label} requested`)
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const remove = async (id) => {
    try {
      await api.delete(`/devices/${id}`)
      toast.success('Device deleted')
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const openQr = async (device) => {
    setQrDevice(device)
    try {
      await api.post(`/devices/${device.id}/connect`)
    } catch {
      /* may already be connecting */
    }
  }

  return (
    <div>
      <PageHeader
        title="Devices"
        subtitle="Manage WhatsApp device connections"
        actions={
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Add Device
          </button>
        }
      />

      <div className="mb-4 max-w-xs">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <PageSpinner />
      ) : devices.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No devices yet"
          message="Add a device to start sending and receiving WhatsApp messages."
          action={
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Add Device
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-400">{d.phoneNumber || 'Not linked'}</p>
                  </div>
                </div>
                <Badge status={d.status}>
                  {d.connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {d.status}
                </Badge>
              </div>

              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Group</span>
                  <span className="text-slate-700">{d.group?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto reconnect</span>
                  <span className="text-slate-700">{d.autoReconnect ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kuota pesan</span>
                  <span className="text-slate-700">
                    {d.quotaUsed ?? 0} / {Number(d.quota) > 0 ? d.quota : 'Tanpa batas'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span title="Batas harian penerima unik (meniru tier Meta). OTP & balasan inbox tidak dihitung.">
                    Penerima unik hari ini
                  </span>
                  {isSuperAdmin ? (
                    <span className="flex items-center gap-1 text-slate-700">
                      {d.dailyRecipientsUsed ?? 0} /
                      <select
                        className="input h-7 w-auto py-0 text-xs"
                        value={d.dailyRecipientLimit ?? 250}
                        onChange={(e) => setDailyLimit(d.id, e.target.value)}
                      >
                        {DAILY_TIERS.map((t) => (
                          <option key={t} value={t}>{t > 0 ? t.toLocaleString('id-ID') : 'Tanpa batas'}</option>
                        ))}
                      </select>
                    </span>
                  ) : (
                    <span className="text-slate-700">
                      {d.dailyRecipientsUsed ?? 0} / {Number(d.dailyRecipientLimit) > 0 ? d.dailyRecipientLimit : 'Tanpa batas'}
                    </span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span>Last seen</span>
                  <span className="text-slate-700">{fmtDate(d.lastSeenAt)}</span>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span>Owner</span>
                    <select
                      className="input h-7 max-w-[60%] py-0 text-xs"
                      value={d.ownerId || ''}
                      onChange={(e) => reassign(d.id, e.target.value)}
                    >
                      <option value="" disabled>
                        {d.owner?.name || 'Tanpa pemilik'}
                      </option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => openQr(d)}>
                  <QrCode size={14} /> QR
                </button>
                <button
                  className="btn-secondary px-2.5 py-1.5 text-xs"
                  onClick={() => action(d.id, 'restart', 'Restart')}
                >
                  <RefreshCw size={14} /> Restart
                </button>
                <button
                  className="btn-secondary px-2.5 py-1.5 text-xs"
                  onClick={() =>
                    setConfirm({
                      title: 'Logout device?',
                      message: `This will unlink ${d.name} from WhatsApp.`,
                      confirmText: 'Logout',
                      danger: true,
                      onConfirm: () => action(d.id, 'logout', 'Logout'),
                    })
                  }
                >
                  <LogOut size={14} /> Logout
                </button>
                <button
                  className="btn-ghost px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  onClick={() =>
                    setConfirm({
                      title: 'Delete device?',
                      message: `Permanently delete ${d.name}? This cannot be undone.`,
                      confirmText: 'Delete',
                      danger: true,
                      onConfirm: () => remove(d.id),
                    })
                  }
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddDeviceModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />

      <QrModal device={qrDevice} onClose={() => setQrDevice(null)} onConnected={load} />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
        danger={confirm?.danger}
      />
    </div>
  )
}

function AddDeviceModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', webhookUrl: '', autoReconnect: true, quota: 0 })
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ name: '', webhookUrl: '', autoReconnect: true, quota: 0 })
    api
      .get('/devices/groups')
      .then((r) => setGroups(r.data?.data || []))
      .catch(() => {})
  }, [open])

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const res = await api.post('/devices', {
        name: form.name,
        groupId: form.groupId || undefined,
        webhookUrl: form.webhookUrl || undefined,
        autoReconnect: form.autoReconnect,
        quota: Number(form.quota) || 0,
      })
      toast.success(res.data?.message || 'Device created')
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
      title="Add Device"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner size={16} /> : 'Create'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sales Phone"
          />
        </div>
        <div>
          <label className="label">Group</label>
          <select
            className="input"
            value={form.groupId || ''}
            onChange={(e) => setForm({ ...form, groupId: e.target.value })}
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Webhook URL</label>
          <input
            className="input"
            value={form.webhookUrl}
            onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
            placeholder="https://example.com/webhook"
          />
        </div>
        <div>
          <label className="label">Kuota pesan (0 = tanpa batas)</label>
          <input
            type="number"
            className="input"
            value={form.quota}
            onChange={(e) => setForm({ ...form, quota: e.target.value })}
            placeholder="0"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.autoReconnect}
            onChange={(e) => setForm({ ...form, autoReconnect: e.target.checked })}
          />
          Auto reconnect
        </label>
      </div>
    </Modal>
  )
}

function QrModal({ device, onClose, onConnected }) {
  const [qr, setQr] = useState(null)
  const [status, setStatus] = useState(null)
  const open = !!device

  // Poll QR every 3s while open
  useEffect(() => {
    if (!open) {
      setQr(null)
      setStatus(null)
      return
    }
    let alive = true
    const poll = async () => {
      try {
        const res = await api.get(`/devices/${device.id}/qr`)
        if (!alive) return
        const data = res.data?.data || {}
        setQr(data.qr)
        setStatus(data.status)
        if (data.status === 'CONNECTED') {
          toast.success('Device connected!')
          onConnected?.()
          onClose?.()
        }
      } catch {
        /* ignore */
      }
    }
    poll()
    const t = setInterval(poll, 3000)
    return () => {
      alive = false
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device?.id])

  // Live QR via socket
  useEffect(() => {
    if (!open) return
    const off = onSocket('device:qr', (p) => {
      if (p.id === device.id) setQr(p.qr)
    })
    const offStatus = onSocket('device:status', (p) => {
      if (p.id === device.id) {
        setStatus(p.status)
        if (p.status === 'CONNECTED') {
          toast.success('Device connected!')
          onConnected?.()
          onClose?.()
        }
      }
    })
    return () => {
      off?.()
      offStatus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device?.id])

  return (
    <Modal open={open} onClose={onClose} title={`Scan QR — ${device?.name || ''}`} size="sm">
      <div className="flex flex-col items-center gap-3 py-2">
        {status && <Badge status={status}>{status}</Badge>}
        {qr ? (
          <img src={qr} alt="QR code" className="h-64 w-64 rounded-lg border border-slate-200" />
        ) : (
          <div className="flex h-64 w-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <Spinner size={28} />
            <p className="text-xs text-slate-500">Waiting for QR code...</p>
          </div>
        )}
        <p className="max-w-xs text-center text-xs text-slate-500">
          Open WhatsApp on your phone → Linked Devices → Link a device, then scan this code.
        </p>
      </div>
    </Modal>
  )
}
