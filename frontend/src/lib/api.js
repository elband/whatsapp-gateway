import axios from 'axios'
import { useAuth } from '../store/auth'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
export const API_BASE = `${API_URL}/api/v1`

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let waiters = []

function onRefreshed(token) {
  waiters.forEach((cb) => cb(token))
  waiters = []
}

async function doRefresh() {
  const { refreshToken } = useAuth.getState()
  // Send body refreshToken if present; cookie also used (withCredentials)
  const res = await axios.post(
    `${API_BASE}/auth/refresh`,
    refreshToken ? { refreshToken } : {},
    { withCredentials: true }
  )
  const data = res.data?.data || {}
  useAuth.getState().setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  })
  return data.accessToken
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status

    if (status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          waiters.push((token) => {
            if (!token) return reject(error)
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }

      isRefreshing = true
      try {
        const newToken = await doRefresh()
        isRefreshing = false
        onRefreshed(newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (e) {
        isRefreshing = false
        onRefreshed(null)
        useAuth.getState().logout()
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(e)
      }
    }

    return Promise.reject(error)
  }
)

// Helper to extract message from a response/error
export const msgOf = (resOrErr, fallback = 'Something went wrong') =>
  resOrErr?.data?.message ||
  resOrErr?.response?.data?.message ||
  resOrErr?.message ||
  fallback

export default api
