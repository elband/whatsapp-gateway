import clsx from 'clsx'

export const cn = (...args) => clsx(...args)

export function fmtDate(d) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleString()
  } catch {
    return String(d)
  }
}

export function fmtBytes(bytes) {
  if (bytes == null) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = Number(bytes)
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

export function fmtUptime(seconds) {
  if (seconds == null) return '-'
  const s = Math.floor(seconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export const GREEN = ['CONNECTED', 'SENT', 'DELIVERED', 'READ', 'COMPLETED', 'INFO']
export const AMBER = [
  'CONNECTING',
  'QUEUED',
  'SENDING',
  'QR',
  'INITIALIZING',
  'RUNNING',
  'SCHEDULED',
  'PAUSED',
  'WARN',
  'WARNING',
]
export const RED = [
  'DISCONNECTED',
  'FAILED',
  'LOGGED_OUT',
  'CANCELLED',
  'ERROR',
]

export function statusTone(status) {
  const s = String(status || '').toUpperCase()
  if (GREEN.includes(s)) return 'green'
  if (AMBER.includes(s)) return 'amber'
  if (RED.includes(s)) return 'red'
  return 'gray'
}
