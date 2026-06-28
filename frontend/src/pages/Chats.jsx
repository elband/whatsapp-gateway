import { useEffect, useState, useCallback, useRef } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { msgOf } from '../lib/api'
import PageHeader from '../components/PageHeader'
import Spinner, { PageSpinner } from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import Badge from '../components/Badge'
import { connectSocket, onSocket } from '../lib/socket'

function fmtTime(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function Chats() {
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [chats, setChats] = useState([])
  const [chatsLoading, setChatsLoading] = useState(false)
  const [active, setActive] = useState(null) // selected phone
  const [thread, setThread] = useState([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const threadEndRef = useRef(null)
  const deviceIdRef = useRef('')
  const activeRef = useRef(null)

  useEffect(() => { deviceIdRef.current = deviceId }, [deviceId])
  useEffect(() => { activeRef.current = active }, [active])

  // Load devices, default to first
  useEffect(() => {
    api
      .get('/devices', { params: { limit: 100 } })
      .then((r) => {
        const list = r.data?.data || []
        setDevices(list)
        if (list.length) setDeviceId(String(list[0].id))
      })
      .catch(() => {})
  }, [])

  const loadChats = useCallback(async () => {
    if (!deviceId) return
    setChatsLoading(true)
    try {
      const res = await api.get('/chats', { params: { deviceId, page: 1, limit: 50 } })
      setChats(res.data?.data || [])
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setChatsLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    setActive(null)
    setThread([])
    loadChats()
  }, [loadChats])

  const loadThread = useCallback(async (phone) => {
    if (!deviceId || !phone) return
    setThreadLoading(true)
    try {
      const res = await api.get(`/chats/${phone}`, { params: { deviceId, page: 1, limit: 100 } })
      setThread(res.data?.data?.items || [])
    } catch (e) {
      toast.error(msgOf(e))
    } finally {
      setThreadLoading(false)
    }
  }, [deviceId])

  const openChat = async (phone) => {
    setActive(phone)
    await loadThread(phone)
    try {
      await api.post(`/chats/${phone}/seen`, { deviceId })
    } catch {
      /* ignore */
    }
    loadChats()
  }

  // Auto-scroll thread to bottom on new messages
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  // Realtime
  useEffect(() => {
    connectSocket()
    const offInc = onSocket('message:incoming', (m) => {
      if (String(m?.deviceId) !== String(deviceIdRef.current)) return
      loadChats()
      if (m?.from && activeRef.current && String(m.from).includes(String(activeRef.current))) {
        loadThread(activeRef.current)
      }
    })
    const offStatus = onSocket('message:status', () => {
      if (activeRef.current) loadThread(activeRef.current)
    })
    return () => {
      offInc?.()
      offStatus?.()
    }
  }, [loadChats, loadThread])

  const sendReply = async (e) => {
    e.preventDefault()
    if (!reply.trim() || !active) return
    setSending(true)
    try {
      await api.post(`/chats/${active}/reply`, { deviceId, body: reply })
      setReply('')
      await loadThread(active)
      loadChats()
    } catch (err) {
      toast.error(msgOf(err, 'Failed to send'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="Percakapan WhatsApp masuk dan keluar"
        actions={
          <select
            className="input w-56"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">Pilih device</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.phoneNumber ? `(${d.phoneNumber})` : ''}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid h-[calc(100vh-13rem)] grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Conversation list */}
        <div className="card flex flex-col overflow-hidden lg:col-span-1">
          {chatsLoading ? (
            <PageSpinner />
          ) : chats.length === 0 ? (
            <div className="flex h-full items-center justify-center p-4">
              <EmptyState icon={MessageSquare} title="Belum ada percakapan" message="Percakapan akan muncul di sini." />
            </div>
          ) : (
            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {chats.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => openChat(c.phone)}
                  className={
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ' +
                    (active === c.phone ? 'bg-brand-50' : '')
                  }
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
                    {(c.name || c.phone || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">{c.name || c.phone}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{fmtTime(c.lastAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-slate-500">{c.lastMessage?.body || '-'}</p>
                      {c.unread > 0 && (
                        <Badge tone="green" className="shrink-0">{c.unread}</Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread */}
        <div className="card flex flex-col overflow-hidden lg:col-span-2">
          {!active ? (
            <div className="flex h-full items-center justify-center p-4">
              <EmptyState icon={MessageSquare} title="Pilih percakapan" message="Pilih percakapan di sebelah kiri untuk melihat pesan." />
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 px-5 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {chats.find((c) => c.phone === active)?.name || active}
                </p>
                <p className="text-xs text-slate-400">{active}</p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-4 py-4">
                {threadLoading ? (
                  <PageSpinner />
                ) : thread.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState icon={MessageSquare} title="Belum ada pesan" />
                  </div>
                ) : (
                  thread.map((m) => {
                    const out = m.direction === 'OUTBOUND'
                    return (
                      <div key={m.id} className={'flex ' + (out ? 'justify-end' : 'justify-start')}>
                        <div
                          className={
                            'max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ' +
                            (out ? 'bg-brand-500 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-200')
                          }
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body || `[${m.type}]`}</p>
                          <div className={'mt-1 flex items-center justify-end gap-1 text-[10px] ' + (out ? 'text-brand-100' : 'text-slate-400')}>
                            <span>{fmtTime(m.createdAt)}</span>
                            {out && <span>· {m.status}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              <form onSubmit={sendReply} className="flex items-center gap-2 border-t border-slate-200 px-4 py-3">
                <input
                  className="input flex-1"
                  placeholder="Ketik balasan..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button type="submit" className="btn-primary" disabled={sending || !reply.trim()}>
                  {sending ? <Spinner size={16} /> : <Send size={16} />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
