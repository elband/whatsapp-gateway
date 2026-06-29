import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { PageSpinner } from './components/Spinner'
import api from './lib/api'
import { useAuth } from './store/auth'

import Login from './pages/Login' // eager: halaman pertama

// M6: lazy-load tiap halaman → code-splitting, bundle awal lebih kecil.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Devices = lazy(() => import('./pages/Devices'))
const Chats = lazy(() => import('./pages/Chats'))
const Messages = lazy(() => import('./pages/Messages'))
const Broadcast = lazy(() => import('./pages/Broadcast'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Templates = lazy(() => import('./pages/Templates'))
const Autoresponder = lazy(() => import('./pages/Autoresponder'))
const Tools = lazy(() => import('./pages/Tools'))
const Webhooks = lazy(() => import('./pages/Webhooks'))
const Logs = lazy(() => import('./pages/Logs'))
const Users = lazy(() => import('./pages/Users'))
const Roles = lazy(() => import('./pages/Roles'))
const ApiKeys = lazy(() => import('./pages/ApiKeys'))
const ApiDocs = lazy(() => import('./pages/ApiDocs'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  const [booting, setBooting] = useState(true)
  const { user, accessToken, setTokens, logout } = useAuth()

  // Bootstrap: pulihkan sesi via httpOnly cookie (refresh) saat reload,
  // karena token tidak lagi disimpan di localStorage (H3).
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!accessToken && user) {
        try {
          const res = await api.post('/auth/refresh', {})
          if (alive) setTokens(res.data?.data || {})
        } catch {
          if (alive) logout()
        }
      }
      if (alive) setBooting(false)
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (booting) return <div className="flex h-screen items-center justify-center"><PageSpinner /></div>

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><PageSpinner /></div>}>
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chats" element={<Chats />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/autoresponder" element={<Autoresponder />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/broadcast" element={<Broadcast />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/users" element={<Users />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/api-docs" element={<ApiDocs />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  )
}
