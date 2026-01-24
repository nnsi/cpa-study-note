/**
 * インメモリ Rate Limit Store
 *
 * 開発・テスト用。単一インスタンスでのみ有効。
 * 本番環境では Durable Objects を使用すること。
 */
import type {
  RateLimitStore,
  RateLimitConfig,
  RateLimitResult,
  RateLimitInfo,
} from "../types"

type StoredEntry = {
  info: RateLimitInfo
  expiresAt: number
}

export const createMemoryRateLimitStore = (): RateLimitStore => {
  const store = new Map<string, StoredEntry>()

  // 定期的に期限切れエントリを削除（メモリリーク防止）
  const cleanup = () => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.expiresAt < now) {
        store.delete(key)
      }
    }
  }

  // 1分ごとにクリーンアップ
  setInterval(cleanup, 60_000)

  const calculateTokens = (
    info: RateLimitInfo | undefined,
    config: RateLimitConfig,
    now: number
  ): { tokens: number; lastRefillAt: number } => {
    if (!info) {
      // 初回アクセス: 満タン
      return { tokens: config.limit, lastRefillAt: now }
    }

    // Token Bucket: 経過時間に応じてトークン補充
    const elapsed = now - info.lastRefillAt
    const tokensPerMs = config.limit / config.windowMs
    const tokensToAdd = Math.floor(elapsed * tokensPerMs)

    const newTokens = Math.min(config.limit, info.tokens + tokensToAdd)
    const newLastRefillAt = tokensToAdd > 0 ? now : info.lastRefillAt

    return { tokens: newTokens, lastRefillAt: newLastRefillAt }
  }

  const check: RateLimitStore["check"] = async (key, config) => {
    const now = Date.now()
    const entry = store.get(key)
    const { tokens, lastRefillAt } = calculateTokens(entry?.info, config, now)

    if (tokens < 1) {
      // トークン不足: 拒否
      const resetInMs = Math.ceil((1 - tokens) / (config.limit / config.windowMs))
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.ceil(resetInMs / 1000),
        limit: config.limit,
      }
    }

    // トークン消費
    const newInfo: RateLimitInfo = {
      tokens: tokens - 1,
      lastRefillAt,
    }

    store.set(key, {
      info: newInfo,
      expiresAt: now + config.windowMs * 2, // 2ウィンドウ後に期限切れ
    })

    return {
      allowed: true,
      remaining: newInfo.tokens,
      resetInSeconds: Math.ceil(config.windowMs / 1000),
      limit: config.limit,
    }
  }

  const get: RateLimitStore["get"] = async (key, config) => {
    const now = Date.now()
    const entry = store.get(key)
    const { tokens } = calculateTokens(entry?.info, config, now)

    return {
      allowed: tokens >= 1,
      remaining: Math.max(0, Math.floor(tokens)),
      resetInSeconds: Math.ceil(config.windowMs / 1000),
      limit: config.limit,
    }
  }

  const reset: RateLimitStore["reset"] = async (key) => {
    store.delete(key)
  }

  return { check, get, reset }
}
