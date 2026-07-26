import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuth = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],

      login: ({ user, accessToken, refreshToken, permissions }) =>
        set({
          user: user || null,
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
          permissions: permissions || (user && user.permissions) || [],
        }),

      setTokens: ({ accessToken, refreshToken }) =>
        set((s) => ({
          accessToken: accessToken ?? s.accessToken,
          refreshToken: refreshToken ?? s.refreshToken,
        })),

      setUser: (user) =>
        set({ user, permissions: (user && user.permissions) || [] }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, permissions: [] }),

      // Hanya super_admin yang bypass permission (selaras dengan backend rbac.js).
      // admin biasa mengikuti daftar permission role-nya.
      hasPermission: (name) => {
        const { permissions, user } = get()
        if (!name) return true
        if (String(user?.role || '').toLowerCase() === 'super_admin') return true
        return Array.isArray(permissions) && permissions.includes(name)
      },

      isSuperAdmin: () => String(get().user?.role || '').toLowerCase() === 'super_admin',
    }),
    {
      name: 'wa-gateway-auth',
      // Keamanan (H3): JANGAN simpan token di localStorage. Access token hanya di
      // memori; refresh token hanya di httpOnly cookie. Saat reload, token diambil
      // ulang lewat /auth/refresh (cookie) pada bootstrap App.
      partialize: (s) => ({
        user: s.user,
        permissions: s.permissions,
      }),
    }
  )
)
