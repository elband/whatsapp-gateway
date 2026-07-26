import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function ProtectedRoute({ children }) {
  const { accessToken } = useAuth()
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

// Gerbang berbasis permission untuk halaman khusus (mis. super admin). Bila user
// tidak memiliki permission yang dibutuhkan, alihkan ke dashboard.
export function RequirePermission({ permission, children }) {
  const hasPermission = useAuth((s) => s.hasPermission)
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
