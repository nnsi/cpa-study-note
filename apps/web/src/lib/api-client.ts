import { hc } from "hono/client"
import type { AppType } from "@cpa-study/api"

const getAuthToken = () => {
  return localStorage.getItem("auth_token")
}

export const api = hc<AppType>(
  import.meta.env.VITE_API_URL || "",
  {
    headers: () => {
      const token = getAuthToken()
      return token ? { Authorization: `Bearer ${token}` } : {}
    },
  }
)

// 開発モード用のヘッダー追加
export const apiWithDevAuth = (userId: string) =>
  hc<AppType>(import.meta.env.VITE_API_URL || "", {
    headers: () => ({
      "X-Dev-User-Id": userId,
    }),
  })
