import { useEffect, useState } from 'react'
import { Save, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { PageSpinner } from '../components/Spinner'

export default function Settings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/settings')
      .then((r) => setItems(r.data?.data || []))
      .catch((e) => toast.error(msgOf(e)))
      .finally(() => setLoading(false))
  }, [])

  const setVal = (key, value) => setItems((arr) => arr.map((it) => (it.key === key ? { ...it, value } : it)))

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/settings', { settings: items.map(({ key, value, group }) => ({ key, value, group })) })
      toast.success('Settings saved')
    } catch (e) { toast.error(msgOf(e)) } finally { setSaving(false) }
  }

  if (loading) return (<><PageHeader title="Settings" subtitle="Application configuration" /><PageSpinner /></>)

  // group settings by `group`
  const grouped = items.reduce((acc, it) => {
    (acc[it.group || 'general'] ||= []).push(it)
    return acc
  }, {})

  return (
    <div>
      <PageHeader title="Settings" subtitle="Application configuration"
        actions={<button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner size={16} /> : <><Save size={16} /> Save</>}</button>} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Object.entries(grouped).map(([group, list]) => (
          <div key={group} className="card p-5">
            <h3 className="mb-3 font-semibold capitalize text-slate-800">{group}</h3>
            <div className="space-y-3">
              {list.map((it) => (
                <div key={it.key}>
                  <label className="label">{it.key}</label>
                  <input
                    className="input"
                    value={typeof it.value === 'object' ? JSON.stringify(it.value) : (it.value ?? '')}
                    onChange={(e) => {
                      const raw = e.target.value
                      const num = Number(raw)
                      setVal(it.key, raw !== '' && !Number.isNaN(num) && /^[0-9.]+$/.test(raw) ? num : raw)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <ChangePassword />
      </div>
    </div>
  )
}

function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.currentPassword || !form.newPassword) return toast.error('Fill all fields')
    if (form.newPassword.length < 8) return toast.error('New password must be at least 8 characters')
    if (form.newPassword !== form.confirm) return toast.error('Passwords do not match')
    setSaving(true)
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast.success('Password changed')
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (e) { toast.error(msgOf(e)) } finally { setSaving(false) }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800"><Lock size={16} /> Change Password</h3>
      <div className="space-y-3">
        <div>
          <label className="label">Current password</label>
          <input className="input" type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </div>
        <div>
          <label className="label">New password</label>
          <input className="input" type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input className="input" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? <Spinner size={16} /> : 'Update password'}</button>
      </div>
    </div>
  )
}
