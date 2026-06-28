import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

export default function Roles() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [perms, setPerms] = useState({})
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/roles')
      setRows(res.data?.data || [])
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/roles/permissions').then((r) => setPerms(r.data?.data || {})).catch(() => {})
  }, [])

  const remove = async (id) => {
    try {
      await api.delete(`/roles/${id}`)
      toast.success('Role deleted')
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const columns = [
    { key: 'name', header: 'Role', render: (r) => <span className="font-medium text-slate-800">{r.name}{r.isSystem && <Badge tone="gray" className="ml-2">system</Badge>}</span> },
    { key: 'description', header: 'Description', render: (r) => <span className="text-slate-600">{r.description || '-'}</span> },
    { key: 'permissions', header: 'Permissions', render: (r) => <Badge tone="blue">{(r.permissions || []).length}</Badge> },
    { key: 'userCount', header: 'Users', render: (r) => <span className="text-slate-600">{r.userCount ?? 0}</span> },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost px-2 py-1" onClick={() => setEditing(r)}><Edit2 size={15} /></button>
          {!r.isSystem && (
            <button className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
              onClick={() => setConfirm({ title: 'Delete role?', message: `Delete ${r.name}?`, onConfirm: () => remove(r.id) })}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Roles & Permissions" subtitle="Define what each role can access"
        actions={<button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> New Role</button>} />

      <DataTable columns={columns} data={rows} loading={loading}
        empty={<EmptyState icon={ShieldCheck} title="No roles" message="Create roles to manage permissions." />} />

      <RoleModal role={editing} permGroups={perms} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm}
        title={confirm?.title} message={confirm?.message} confirmText="Delete" />
    </div>
  )
}

function RoleModal({ role, permGroups, onClose, onSaved }) {
  const open = !!role
  const isEdit = role && role.id
  const [form, setForm] = useState({ name: '', description: '' })
  const [selected, setSelected] = useState(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!role) return
    setForm({ name: role.name || '', description: role.description || '' })
    // role.permissions is an array of names; map to ids using permGroups
    const nameToId = {}
    Object.values(permGroups).flat().forEach((p) => { nameToId[p.name] = p.id })
    setSelected(new Set((role.permissions || []).map((n) => nameToId[n]).filter(Boolean)))
  }, [role, permGroups])

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }
  const toggleGroup = (items) => {
    const ids = items.map((p) => p.id)
    const allOn = ids.every((id) => selected.has(id))
    const next = new Set(selected)
    ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)))
    setSelected(next)
  }

  const save = async () => {
    if (!form.name?.trim()) return toast.error('Role name is required')
    setSaving(true)
    try {
      const payload = { name: form.name, description: form.description || undefined, permissionIds: [...selected] }
      const res = isEdit ? await api.put(`/roles/${role.id}`, payload) : await api.post('/roles', payload)
      toast.success(res.data?.message || 'Saved')
      onSaved?.()
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Role' : 'New Role'} size="xl"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner size={16} /> : 'Save'}</button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={role?.isSystem} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label">Permissions</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(permGroups).map(([group, items]) => (
              <div key={group} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize text-slate-700">{group}</span>
                  <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => toggleGroup(items)}>toggle all</button>
                </div>
                <div className="space-y-1">
                  {items.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
