import { hc } from "hono/client"
import type { AppType } from "@cpa-study/api"
import { apiErrorSchema } from "@cpa-study/shared/schemas"
import { useAuthStore, refreshTokenOnUnauthorized } from "./auth"

export const extractErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const json = await res.json()
    const parsed = apiErrorSchema.safeParse(json)
    return parsed.success ? parsed.data.error.message : fallback
  } catch {
    return fallback
  }
}

const getHeaders = (): Record<string, string> => {
  const { token } = useAuthStore.getState()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

// Custom fetch with 401 retry
export const fetchWithRetry: typeof fetch = async (input, init) => {
  // Headers オブジェクトを正しく展開するために Object.fromEntries を使用
  const initHeaders = init?.headers
    ? Object.fromEntries(new Headers(init.headers as HeadersInit).entries())
    : {}

  const headers = {
    ...initHeaders,
    ...getHeaders(),
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include", // Always send cookies
  })

  // If 401, try to refresh token once
  if (response.status === 401) {
    const newToken = await refreshTokenOnUnauthorized()

    if (newToken) {
      // Retry with new token
      return fetch(input, {
        ...init,
        headers: {
          Authorization: `Bearer ${newToken}`,
          ...Object.fromEntries(
            new Headers(init?.headers as HeadersInit | undefined).entries()
          ),
        },
        credentials: "include",
      })
    }
  }

  return response
}

export const api = hc<AppType>(import.meta.env.VITE_API_URL || "", {
  fetch: fetchWithRetry,
})
