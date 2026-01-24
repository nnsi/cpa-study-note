/**
 * Rate Limit Module
 *
 * Adapter パターンでストレージを抽象化:
 * - memory: 開発・テスト用
 * - durable-object: 本番用（Cloudflare Workers）
 */
export { createMemoryRateLimitStore } from "./stores/memory"
export { createDurableObjectRateLimitStore } from "./stores/durable-object"
export { rateLimiter, createRateLimiterFactory } from "./middleware"
export { RateLimiterDO } from "./rate-limiter.do"

export type {
  RateLimitStore,
  RateLimitConfig,
  RateLimitResult,
  RateLimitContext,
  RateLimitStoreType,
  CreateRateLimitStoreOptions,
} from "./types"

import type { RateLimitStore, CreateRateLimitStoreOptions } from "./types"
import { createMemoryRateLimitStore } from "./stores/memory"
import { createDurableObjectRateLimitStore } from "./stores/durable-object"

/**
 * ストアを作成するファクトリ関数
 *
 * @example
 * // 開発環境
 * const store = createRateLimitStore({ type: "memory" })
 *
 * // 本番環境
 * const store = createRateLimitStore({
 *   type: "durable-object",
 *   namespace: env.RATE_LIMITER
 * })
 */
export const createRateLimitStore = (
  options: CreateRateLimitStoreOptions
): RateLimitStore => {
  switch (options.type) {
    case "memory":
      return createMemoryRateLimitStore()
    case "durable-object":
      return createDurableObjectRateLimitStore(options.namespace)
    default: {
      const _exhaustive: never = options
      throw new Error(`Unknown store type: ${_exhaustive}`)
    }
  }
}
