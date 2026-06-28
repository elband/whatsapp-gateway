import { useEffect, useState } from 'react'
import { CheckCircle2, ShieldCheck, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'

export default function Tools() {
  const [devices, setDevices] = useState([])

  useEffect(() => {
    api
      .get('/devices', { params: { limit: 100 } })
      .then((r) => setDevices(r.data?.data || []))
      .catch(() => {})
  }, [])

  return (
    <div>
      <PageHeader title="Tools" subtitle="Cek nomor WhatsApp dan kirim OTP" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CheckNumberCard devices={devices} />
        <OtpCard devices={devices} />
      </div>
    </div>
  )
}

function CheckNumberCard({ devices }) {
  const [deviceId, setDeviceId] = useState('')
  const [numbers, setNumbers] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const check = async () => {
    if (!deviceId) return toast.error('Pilih device')
    const lines = numbers
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean)
    if (!lines.length) return toast.error('Masukkan minimal satu nomor')
    setLoading(true)
    try {
      const res = await api.post('/messages/check', { deviceId, numbers: lines })
      setResults(res.data?.data || [])
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-900">Cek Nomor WhatsApp</h3>
      </div>

      <div>
        <label className="label">Device</label>
        <select className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">Pilih device</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.phoneNumber ? `(${d.phoneNumber})` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">Device harus terhubung.</p>
      </div>

      <div>
        <label className="label">Nomor (satu per baris)</label>
        <textarea
          className="input min-h-[120px]"
          placeholder={'6281234567890\n6289876543210'}
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
        />
      </div>

      <button className="btn-primary w-full" onClick={check} disabled={loading}>
        {loading ? <Spinner size={16} /> : 'Cek'}
      </button>

      {results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-slate-700">{r.phone || r.input}</td>
                    <td className="px-4 py-2">
                      {r.error ? (
                        <Badge tone="amber">{r.error}</Badge>
                      ) : r.exists ? (
                        <Badge tone="green">Terdaftar</Badge>
                      ) : (
                        <Badge tone="red">Tidak ada</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function OtpCard({ devices }) {
  const [deviceId, setDeviceId] = useState('')
  const [to, setTo] = useState('')
  const [length, setLength] = useState(6)
  const [sending, setSending] = useState(false)

  const [verifyTo, setVerifyTo] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const send = async () => {
    if (!deviceId) return toast.error('Pilih device')
    if (!to.trim()) return toast.error('Nomor tujuan wajib diisi')
    setSending(true)
    try {
      const res = await api.post('/otp/send', { deviceId, to, length: Number(length) || 6 })
      const data = res.data?.data || {}
      toast.success(`OTP terkirim (id: ${data.otpId})`)
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setSending(false)
    }
  }

  const verify = async () => {
    if (!verifyTo.trim() || !code.trim()) return toast.error('Nomor dan kode wajib diisi')
    setVerifying(true)
    try {
      const res = await api.post('/otp/verify', { to: verifyTo, code })
      const data = res.data?.data || {}
      if (data.valid) {
        toast.success('OTP valid')
      } else {
        toast.error(`OTP tidak valid${data.reason ? `: ${data.reason}` : ''}`)
      }
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-900">OTP</h3>
      </div>

      <div>
        <label className="label">Device</label>
        <select className="input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">Pilih device</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.phoneNumber ? `(${d.phoneNumber})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="label">Nomor tujuan</label>
          <input className="input" placeholder="6281234567890" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Panjang</label>
          <input type="number" className="input" value={length} onChange={(e) => setLength(e.target.value)} />
        </div>
      </div>

      <button className="btn-primary w-full" onClick={send} disabled={sending}>
        {sending ? <Spinner size={16} /> : <><Send size={16} /> Kirim OTP</>}
      </button>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verifikasi OTP</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Nomor</label>
            <input className="input" placeholder="6281234567890" value={verifyTo} onChange={(e) => setVerifyTo(e.target.value)} />
          </div>
          <div>
            <label className="label">Kode</label>
            <input className="input" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        </div>
        <button className="btn-secondary w-full" onClick={verify} disabled={verifying}>
          {verifying ? <Spinner size={16} /> : 'Verifikasi'}
        </button>
      </div>
    </div>
  )
}
