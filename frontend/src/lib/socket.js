import { io } from 'socket.io-client'
import { API_URL } from './api'
import { useAuth } from '../store/auth'

let socket = null

export function connectSocket() {
  const token = useAuth.getState().accessToken
  if (!token) return null

  if (socket && socket.connected) return socket
  if (socket) {
    socket.auth = { token }
    socket.connect()
    return socket
  }

  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  })

  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

/**
 * Subscribe to an event; returns an unsubscribe fn.
 */
export function onSocket(event, handler) {
  const s = socket || connectSocket()
  if (!s) return () => {}
  s.on(event, handler)
  return () => s.off(event, handler)
}
