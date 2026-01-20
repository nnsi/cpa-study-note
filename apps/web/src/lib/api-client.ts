import { hc } from "hono/client"
import type { AppType } from "@cpa-study/api"

const isDevMode = import.meta.env.VITE_AUTH_MODE === "dev"
const devUserId = import.meta.env.VITE_DEV_USER_ID || "test-user-1"

const getHeaders = (): Record<string, string> => {
  // zustandのストレージから直接読み取り
  const stored = localStorage.getItem("auth-storage")
  if (!stored) return {}

  try {
    const { state } = JSON.parse(stored)
    const token = state?.token

    if (!token) return {}

    // 開発モードかつ開発用トークンの場合: X-Dev-User-Id ヘッダーを使用
    if (isDevMode && token === "dev-token") {
      return { "X-Dev-User-Id": devUserId }
    }

    // 通常のJWTトークンを使用
    return { Authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export const api = hc<AppType>(import.meta.env.VITE_API_URL || "", {
  headers: getHeaders,
})
