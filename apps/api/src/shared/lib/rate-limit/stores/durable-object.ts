/**
 * Durable Object Rate Limit Store
 *
 * Cloudflare Durable Objects を使用した分散レート制限ストア
 * 本番環境向け。複数ワーカーインスタンス間で状態を共有。
 */
import type {
  RateLimitStore,
  RateLimitConfig,
  RateLimitResult,
} from "../types"

type CheckRequest = {
  action: "check" | "get"
  limit: number
  windowMs: number
}

type CheckResponse = {
  allowed: boolean
  remaining: number
  resetInSeconds: number
  limit: number
}

export const createDurableObjectRateLimitStore = (
  namespace: DurableObjectNamespace
): RateLimitStore => {
  const getDurableObject = (key: string) => {
    const id = namespace.idFromName(key)
    return namespace.get(id)
  }

  const check: RateLimitStore["check"] = async (key, config) => {
    const stub = getDurableObject(key)

    const request: CheckRequest = {
      action: "check",
      limit: config.limit,
      windowMs: config.windowMs,
    }

    const response = await stub.fetch("https://rate-limiter/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    const result: CheckResponse = await response.json()

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetInSeconds: result.resetInSeconds,
      limit: result.limit,
    }
  }

  const get: RateLimitStore["get"] = async (key, config) => {
    const stub = getDurableObject(key)

    const request: CheckRequest = {
      action: "get",
      limit: config.limit,
      windowMs: config.windowMs,
    }

    const response = await stub.fetch("https://rate-limiter/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    const result: CheckResponse = await response.json()

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetInSeconds: result.resetInSeconds,
      limit: result.limit,
    }
  }

  // DOはresetをサポートしない（テスト用途なし）
  return { check, get }
}
