import { create } from "zustand"
import { persist } from "zustand/middleware"

type User = {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

type AuthState = {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem("auth_token", token)
        set({ user, token })
      },
      clearAuth: () => {
        localStorage.removeItem("auth_token")
        set({ user: null, token: null })
      },
      isAuthenticated: () => !!get().token,
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
)
