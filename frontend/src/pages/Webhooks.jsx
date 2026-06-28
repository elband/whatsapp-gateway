import { useEffect, useState, useCallback } from 'react'
import { Webhook, Send, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { PageSpinner } from '../components/Spinner'
import { fmtDate } from '../lib/utils'

export default function Webhooks() {
  const [devices, setDevices] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [deliveries, setDeliveries] = useState([])

  const loadDevices = useCallback(async () => {
    setLoading(true)
    try {
      const [d, e] = await Promise.all([
        api.get('/devices', { params: { limit: 100 } }),
        api.get('/webhooks/events'),
      ])
      setDevices(d.data?.data || [])
      setEvents(e.data?.data || [])
    } catch (err) {
      toast.error(msgOf(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  const loadDeliveries = useCallback(async (deviceId) => {
    try {
      const res = await api.get('/webhooks/deliveries', { params: { deviceId, limit: 20 } })
      setDeliveries(res.data?.data || [])
    } catch { setDeliveries([]) }
  }, [])

  const openDevice = (d) => {
    setSelected(d)
    loadDeliveries(d.id)
  }

  if (loading) return (<><PageHeader title="Webhooks" subtitle="Per-device webhook configuration & deliveries" /><PageSpinner /></>)

  return (
    <div>
      <PageHeader title="Webhooks" subtitle="Per-device webhook configuration & deliveries" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card divide-y divide-slate-100">
          {devices.length === 0 && <div className="p-4"><EmptyState icon={Webhook} title="No devices" message="Add a device first." /></div>}
          {devices.map((d) => (
            <button key={d.id} onClick={() => openDevice(d)}
              className={'flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 ' + (selected?.id === d.id ? 'bg-brand-50' : '')}>
              <div>
                <div className="font-medium text-slate-800">{d.name}</div>
                <div className="text-xs text-slate-500">{d.webhookUrl ? d.webhookUrl : 'no webhook set'}</div>
              </div>
              <Badge status={d.status}>{d.status}</Badge>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <WebhookEditor device={selected} events={events} onSaved={(updated) => { setSelected(updated); loadDevices() }} deliveries={deliveries} />
          ) : (
            <div className="card p-8"><EmptyState icon={Webhook} title="Select a device" message="Choose a device to configure its webhook." /></div>
          )}
        </div>
      </div>
    </div>
  )
}

function WebhookEditor({ device, events, onSaved, deliveries }) {
  const [url, setUrl] = useState('')
  const [subscribed, setSubscribed] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setUrl(device.webhookUrl || '')
    setSubscribed(new Set(Array.isArray(device.webhookEvents) ? device.webhookEvents : []))
  }, [device])

  const toggle = (ev) => {
    const next = new Set(subscribed)
    next.has(ev) ? next.delete(ev) : next.add(ev)
    setSubscribed(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.put(`/devices/${device.id}`, {
        webhookUrl: url || null,
        webhookEvents: subscribed.size ? [...subscribed] : null,
      })
      toast.success('Webhook saved')
      onSaved?.(res.data?.data)
    } catch (e) { toast.error(msgOf(e)) } finally { setSaving(false) }
  }

  const test = async () => {
    if (!url) return toast.error('Enter a webhook URL first')
    setTesting(true)
    try {
      const res = await api.post('/webhooks/test', { url })
      const ok = res.data?.data?.ok
      ok ? toast.success(`Webhook OK (HTTP ${res.data?.data?.status})`) : toast.error(`Failed: ${res.data?.data?.error || res.data?.data?.status}`)
    } catch (e) { toast.error(msgOf(e)) } finally { setTesting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="mb-3 font-semibold text-slate-800">{device.name} — Webhook</h3>
        <label className="label">Webhook URL</label>
        <input className="input" placeholder="https://your-app.com/wa/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />

        <label className="label mt-4">Subscribed events <span className="font-normal text-slate-400">(none = all)</span></label>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {events.map((ev) => (
            <label key={ev} className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={subscribed.has(ev)} onChange={() => toggle(ev)} />
              <code className="text-xs">{ev}</code>
            </label>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner size={16} /> : <><Save size={16} /> Save</>}</button>
          <button className="btn-secondary" onClick={test} disabled={testing}>{testing ? <Spinner size={16} /> : <><Send size={16} /> Test</>}</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-semibold text-slate-800">Recent deliveries</h3>
        {deliveries.length === 0 ? (
          <p className="text-sm text-slate-500">No webhook deliveries logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">{d.action}</span>
                <span className="text-slate-400">{fmtDate(d.createdAt)}</span>
                <Badge status={d.level}>{d.level}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
