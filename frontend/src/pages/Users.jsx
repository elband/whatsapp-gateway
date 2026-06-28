import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Users as UsersIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { fmtDate } from '../lib/utils'

export default function Users() {
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState([])
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/users', { params: { page, limit: 20 } })
      setRows(res.data?.data || [])
      setMeta(res.data?.meta || { page: 1, totalPages: 1, total: 0 })
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/roles').then((r) => setRoles(r.data?.data || [])).catch(() => {})
  }, [])

  const remove = async (id) => {
    try {
      await api.delete(`/users/${id}`)
      toast.success('User deleted')
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (r) => <Badge tone="blue">{r.role?.name || r.role || '-'}</Badge> },
    { key: 'isActive', header: 'Status', render: (r) => <Badge tone={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'lastLoginAt', header: 'Last login', render: (r) => <span className="text-slate-500">{fmtDate(r.lastLoginAt)}</span> },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost px-2 py-1" onClick={() => setEditing(r)}><Edit2 size={15} /></button>
          <button className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
            onClick={() => setConfirm({ title: 'Delete user?', message: `Delete ${r.name}?`, onConfirm: () => remove(r.id) })}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage dashboard users & roles"
        actions={<button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> New User</button>} />

      <DataTable columns={columns} data={rows} loading={loading}
        empty={<EmptyState icon={UsersIcon} title="No users" message="Add users to access the dashboard." />} />
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />

      <UserModal user={editing} roles={roles} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm}
        title={confirm?.title} message={confirm?.message} confirmText="Delete" />
    </div>
  )
}

function UserModal({ user, roles, onClose, onSaved }) {
  const open = !!user
  const isEdit = user && user.id
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      roleId: user.roleId || user.role?.id || (roles[0]?.id ?? ''),
      isActive: user.isActive ?? true,
    })
  }, [user, roles])

  const save = async () => {
    if (!form.name?.trim() || !form.email?.trim()) return toast.error('Name and email are required')
    if (!isEdit && !form.password) return toast.error('Password is required')
    setSaving(true)
    try {
      const payload = {
        name: form.name, email: form.email, phone: form.phone || undefined, roleId: Number(form.roleId),
      }
      if (form.password) payload.password = form.password
      if (isEdit) payload.isActive = form.isActive
      const res = isEdit ? await api.put(`/users/${user.id}`, payload) : await api.post('/users', payload)
      toast.success(res.data?.message || 'Saved')
      onSaved?.()
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit User' : 'New User'}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner size={16} /> : 'Save'}</button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{isEdit ? 'New password (optional)' : 'Password *'}</label>
            <input className="input" type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.roleId || ''} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        )}
      </div>
    </Modal>
  )
}
