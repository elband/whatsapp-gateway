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
