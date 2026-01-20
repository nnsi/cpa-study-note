import { create } from "zustand"
import { persist } from "zustand/middleware"
import { redirect } from "@tanstack/react-router"

/**
 * 開発モード判定
 * VITE_AUTH_MODE=dev の場合のみ有効
 * 本番ビルドでは環境変数が設定されないため自動的に無効化される
 */
export const isDevMode = import.meta.env.VITE_AUTH_MODE === "dev"
const devUserId = import.meta.env.VITE_DEV_USER_ID || "test-user-1"

// 開発用テストユーザー（本番では isDevMode=false のため使用されない）
const devUser: User = {
  id: devUserId,
  email: `${devUserId}@example.com`,
  displayName: "テストユーザー",
  avatarUrl: null,
}

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
  setDevAuth: () => void
  clearAuth: () => void
  isAuthenticated: () => boolean
  isDevUser: () => boolean
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
      setDevAuth: () => {
        set({ user: devUser, token: "dev-token" })
      },
      clearAuth: () => {
        localStorage.removeItem("auth_token")
        set({ user: null, token: null })
      },
      isAuthenticated: () => !!get().token,
      isDevUser: () => get().token === "dev-token",
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
)

// 認証ガード: beforeLoadで使用
export const requireAuth = () => {
  const { token } = useAuthStore.getState()
  if (!token) {
    throw redirect({ to: "/login" })
  }
}
