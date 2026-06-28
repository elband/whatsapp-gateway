import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Upload, Users, FolderPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { normalizePhonePreview } from '../lib/phone'

export default function Contacts() {
  const [rows, setRows] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState('')
  const [editing, setEditing] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const loadGroups = useCallback(() => {
    api.get('/contacts/groups').then((r) => setGroups(r.data?.data || [])).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/contacts', {
        params: { search: search || undefined, groupId: groupId || undefined },
      })
      setRows(res.data?.data || [])
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setLoading(false)
    }
  }, [search, groupId])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const remove = async (id) => {
    try {
      await api.delete(`/contacts/${id}`)
      toast.success('Contact deleted')
      load()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email', render: (r) => r.email || '-' },
    {
      key: 'tags',
      header: 'Tags',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {(r.tags || []).map((t) => (
            <Badge key={t} tone="blue">{t}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'groups',
      header: 'Groups',
      render: (r) => (r.groups || []).map((g) => g.name).join(', ') || '-',
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="btn-ghost px-2 py-1" onClick={() => setEditing(r)}>
            <Edit2 size={15} />
          </button>
          <button
            className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50"
            onClick={() =>
              setConfirm({ title: 'Delete contact?', message: `Delete ${r.name}?`, onConfirm: () => remove(r.id) })
            }
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
        title="Contacts"
        subtitle="Manage your contact directory"
        actions={
          <>
            <button className="btn-secondary" onClick={() => setGroupOpen(true)}>
              <FolderPlus size={16} /> Groups
            </button>
            <button className="btn-secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} /> Import
            </button>
            <button className="btn-primary" onClick={() => setEditing({})}>
              <Plus size={16} /> Add Contact
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input max-w-xs" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        empty={<EmptyState icon={Users} title="No contacts" message="Add a contact or import from Excel/CSV." />}
      />

      <ContactModal
        contact={editing}
        groups={groups}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />

      <ImportModal open={importOpen} groups={groups} onClose={() => setImportOpen(false)} onSaved={load} />

      <GroupsModal
        open={groupOpen}
        groups={groups}
        onClose={() => setGroupOpen(false)}
        onChanged={() => {
          loadGroups()
          load()
        }}
      />

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

function ContactModal({ contact, groups, onClose, onSaved }) {
  const open = !!contact
  const isEdit = contact && contact.id
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!contact) return
    setForm({
      name: contact.name || '',
      phone: contact.phone || '',
      email: contact.email || '',
      tags: (contact.tags || []).join(', '),
      groupIds: (contact.groups || []).map((g) => g.id),
    })
  }, [contact])

  const save = async () => {
    if (!form.name?.trim() || !form.phone?.trim()) return toast.error('Name and phone are required')
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        groupIds: form.groupIds || [],
      }
      const res = isEdit ? await api.put(`/contacts/${contact.id}`, payload) : await api.post('/contacts', payload)
      toast.success(res.data?.message || 'Saved')
      onSaved?.()
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setSaving(false)
    }
  }

  const toggleGroup = (id) => {
    setForm((f) => {
      const set = new Set(f.groupIds || [])
      set.has(id) ? set.delete(id) : set.add(id)
      return { ...f, groupIds: [...set] }
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Contact' : 'Add Contact'}
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
        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone *</label>
          <input className="input" placeholder="08123456789" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {form.phone ? (() => { const p = normalizePhonePreview(form.phone); return (
            <p className={`mt-1 text-xs ${p.ok ? 'text-slate-500' : 'text-red-500'}`}>{p.ok ? `Disimpan sebagai ${p.display}` : 'Nomor tidak valid'}</p>
          ) })() : null}
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Tags (comma separated)</label>
          <input className="input" value={form.tags || ''} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, lead" />
        </div>
        {groups.length > 0 && (
          <div>
            <label className="label">Groups</label>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const active = (form.groupIds || []).includes(g.id)
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    className={
                      'rounded-full px-3 py-1 text-xs font-medium ring-1 ' +
                      (active ? 'bg-brand-50 text-brand-700 ring-brand-300' : 'bg-white text-slate-600 ring-slate-300')
                    }
                  >
                    {g.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function ImportModal({ open, groups, onClose, onSaved }) {
  const [file, setFile] = useState(null)
  const [groupId, setGroupId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFile(null)
      setGroupId('')
    }
  }, [open])

  const submit = async () => {
    if (!file) return toast.error('Choose a file')
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (groupId) fd.append('groupId', groupId)
      const res = await api.post('/contacts/import', fd)
      toast.success(res.data?.message || 'Imported')
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
      title="Import Contacts"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner size={16} /> : 'Import'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Excel / CSV file</label>
          <input type="file" accept=".csv,.xlsx,.xls" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <p className="mt-1 text-xs text-slate-400">Columns: name, phone, email (optional)</p>
        </div>
        <div>
          <label className="label">Assign to group</label>
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  )
}

function GroupsModal({ open, groups, onClose, onChanged }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post('/contacts/groups', { name })
      toast.success('Group created')
      setName('')
      onChanged?.()
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    try {
      await api.delete(`/contacts/groups/${id}`)
      toast.success('Group deleted')
      onChanged?.()
    } catch (e) {
      toast.error(msgOf(e))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Contact Groups">
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder="New group name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={add} disabled={saving}>
          {saving ? <Spinner size={16} /> : <Plus size={16} />}
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {groups.length === 0 && <li className="py-4 text-center text-sm text-slate-400">No groups yet</li>}
        {groups.map((g) => (
          <li key={g.id} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-700">{g.name}</span>
            <button className="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50" onClick={() => remove(g.id)}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
