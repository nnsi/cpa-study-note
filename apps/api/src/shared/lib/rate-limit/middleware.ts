/**
 * Hono Rate Limit Middleware
 *
 * Usage:
 * ```ts
 * app.use("/api/auth/*", rateLimiter(store, { limit: 5, windowMs: 60_000 }))
 * app.use("/api/chat/*", rateLimiter(store, { limit: 20, windowMs: 60_000 }))
 * ```
 */
import type { Context, MiddlewareHandler } from "hono"
import type { RateLimitStore, RateLimitConfig, RateLimitContext } from "./types"

type HonoEnv = {
  Bindings: Record<string, unknown>
  Variables: { user?: { id: string }; rateLimitApplied?: boolean }
}

const defaultKeyGenerator = (ctx: RateLimitContext): string => {
  // ユーザーIDがあればユーザー単位、なければIP単位
  if (ctx.userId) {
    return `user:${ctx.userId}`
  }
  return `ip:${ctx.ip}`
}

const extractContext = <E extends HonoEnv>(c: Context<E>): RateLimitContext => {
  // Cloudflare Workers の場合は CF-Connecting-IP
  // ローカル開発の場合は X-Forwarded-For または 127.0.0.1
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "127.0.0.1"

  const user = c.get("user")

  return {
    ip,
    path: c.req.path,
    method: c.req.method,
    userId: user?.id,
  }
}

export const rateLimiter = <E extends HonoEnv>(
  store: RateLimitStore,
  config: RateLimitConfig
): MiddlewareHandler<E> => {
  const keyGenerator = config.keyGenerator ?? defaultKeyGenerator
  const message = config.message ?? "Too Many Requests"

  return async (c, next) => {
    // 既にレート制限が適用されている場合はスキップ
    // （より具体的なパスの制限が優先される）
    if (c.get("rateLimitApplied")) {
      return next()
    }

    const ctx = extractContext(c)

    // カスタムスキップ判定
    if (config.skip) {
      const shouldSkip = await config.skip(ctx)
      if (shouldSkip) {
        return next()
      }
    }

    // このリクエストにレート制限を適用済みとマーク
    c.set("rateLimitApplied", true)

    const key = keyGenerator(ctx)
    const result = await store.check(key, config)

    // レスポンスヘッダーを設定
    c.header("X-RateLimit-Limit", String(result.limit))
    c.header("X-RateLimit-Remaining", String(result.remaining))
    c.header("X-RateLimit-Reset", String(result.resetInSeconds))

    if (!result.allowed) {
      c.header("Retry-After", String(result.resetInSeconds))
      return c.json(
        {
          error: message,
          retryAfter: result.resetInSeconds,
        },
        429
      )
    }

    return next()
  }
}

/**
 * 複数の設定を組み合わせるファクトリ
 *
 * Usage:
 * ```ts
 * const limiter = createRateLimiterFactory(store)
 * app.use("/api/auth/*", limiter.strict())   // 5 req/min
 * app.use("/api/chat/*", limiter.moderate()) // 20 req/min
 * app.use("/api/*", limiter.lenient())       // 100 req/min
 * ```
 */
export const createRateLimiterFactory = <E extends HonoEnv>(store: RateLimitStore) => {
  // プレフィックス付きのキー生成関数を作成
  const createKeyGenerator = (prefix: string) => (ctx: RateLimitContext): string => {
    const base = ctx.userId ? `user:${ctx.userId}` : `ip:${ctx.ip}`
    return `${prefix}:${base}`
  }

  return {
    /** 認証系: 5 req/min */
    strict: (overrides?: Partial<RateLimitConfig>): MiddlewareHandler<E> =>
      rateLimiter<E>(store, {
        limit: 5,
        windowMs: 60_000,
        message: "Too many authentication attempts. Please try again later.",
        keyGenerator: createKeyGenerator("auth"),
        ...overrides,
      }),

    /** AI系: 20 req/min */
    moderate: (overrides?: Partial<RateLimitConfig>): MiddlewareHandler<E> =>
      rateLimiter<E>(store, {
        limit: 20,
        windowMs: 60_000,
        message: "Too many requests. Please slow down.",
        keyGenerator: createKeyGenerator("ai"),
        ...overrides,
      }),

    /** 一般API: 100 req/min */
    lenient: (overrides?: Partial<RateLimitConfig>): MiddlewareHandler<E> =>
      rateLimiter<E>(store, {
        limit: 100,
        windowMs: 60_000,
        keyGenerator: createKeyGenerator("api"),
        ...overrides,
      }),

    /** カスタム設定 */
    custom: (config: RateLimitConfig): MiddlewareHandler<E> =>
      rateLimiter<E>(store, config),
  }
}
