import { create } from "zustand"
import { redirect } from "@tanstack/react-router"

/**
 * ローカル開発モード判定
 * VITE_ENVIRONMENT=local の場合のみ有効
 * staging/productionビルドでは環境変数が異なるため自動的に無効化される
 */
export const isDevMode = import.meta.env.VITE_ENVIRONMENT === "local"

type User = {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

type AuthState = {
  user: User | null
  token: string | null
  isInitializing: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
  setInitializing: (value: boolean) => void
}

// In-memory store (no persistence - tokens are stored in HttpOnly cookies)
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  isInitializing: true,
  setAuth: (user, token) => {
    set({ user, token, isInitializing: false })
  },
  clearAuth: () => {
    set({ user: null, token: null, isInitializing: false })
  },
  isAuthenticated: () => !!get().token,
  setInitializing: (value) => set({ isInitializing: value }),
}))

// Initialize auth on app load (try to refresh token)
let initPromise: Promise<boolean> | null = null

export const initializeAuth = async (): Promise<boolean> => {
  // Prevent multiple concurrent initializations
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
        {
          method: "POST",
          credentials: "include", // Send cookies
        }
      )

      if (!response.ok) {
        useAuthStore.getState().clearAuth()
        return false
      }

      const data = (await response.json()) as {
        accessToken: string
        user: { id: string; email: string; name: string; avatarUrl: string | null }
      }
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.name,
        avatarUrl: data.user.avatarUrl,
      }
      useAuthStore.getState().setAuth(user, data.accessToken)
      return true
    } catch {
      useAuthStore.getState().clearAuth()
      return false
    } finally {
      initPromise = null
    }
  })()

  return initPromise
}

// Refresh token on 401 (call once per 401)
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

export const refreshTokenOnUnauthorized = async (): Promise<string | null> => {
  // Prevent multiple concurrent refreshes
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
        {
          method: "POST",
          credentials: "include",
        }
      )

      if (!response.ok) {
        useAuthStore.getState().clearAuth()
        return null
      }

      const data = (await response.json()) as {
        accessToken: string
        user: { id: string; email: string; name: string; avatarUrl: string | null }
      }
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.name,
        avatarUrl: data.user.avatarUrl,
      }
      useAuthStore.getState().setAuth(user, data.accessToken)
      return data.accessToken
    } catch {
      useAuthStore.getState().clearAuth()
      return null
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// 開発用ログイン（ローカル環境のみ）
export const devLogin = async (): Promise<boolean> => {
  if (!isDevMode) return false

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/auth/dev-login`,
      {
        method: "POST",
        credentials: "include",
      }
    )

    if (!response.ok) {
      return false
    }

    const data = (await response.json()) as {
      accessToken: string
      user: { id: string; email: string; name: string; avatarUrl: string | null }
    }
    const user: User = {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.name,
      avatarUrl: data.user.avatarUrl,
    }
    useAuthStore.getState().setAuth(user, data.accessToken)
    return true
  } catch {
    return false
  }
}

// Logout
export const logout = async (): Promise<void> => {
  try {
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    })
  } catch {
    // Ignore errors
  }
  useAuthStore.getState().clearAuth()
}

// 認証ガード: beforeLoadで使用
export const requireAuth = () => {
  const { token, isInitializing } = useAuthStore.getState()
  if (isInitializing) {
    // Still initializing, let the loader handle it
    return
  }
  if (!token) {
    throw redirect({ to: "/login" })
  }
}
