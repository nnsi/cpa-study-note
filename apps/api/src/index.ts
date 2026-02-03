import { Hono } from "hono"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { logger } from "./shared/middleware/logger"
import { createDb } from "@cpa-study/db"
import { createAuthFeature } from "./features/auth"
import { createChatFeature } from "./features/chat"
import { createNoteFeature } from "./features/note"
import { createImageFeature } from "./features/image"
import { createMetricsFeature } from "./features/metrics"
import { createStudyDomainFeature } from "./features/study-domain"
import { createSubjectFeature } from "./features/subject"
import { createBookmarkFeature } from "./features/bookmark"
import { createLearningFeature } from "./features/learning"
import { createViewFeature } from "./features/view"
import {
  createRateLimitStore,
  createRateLimiterFactory,
  RateLimiterDO,
  type RateLimitStore,
} from "./shared/lib/rate-limit"
import type { Env, Variables } from "./shared/types/env"

// Durable Object をエクスポート（Cloudflare Workers が認識するため）
export { RateLimiterDO }

// メモリストアをモジュールスコープで保持（ローカル開発用）
// Cloudflare Workers ではモジュールスコープはワーカーの生存期間中維持される
let memoryStore: RateLimitStore | null = null

// 環境変数バリデーション
const validateEnv = (env: Env): void => {
  const required: (keyof Env)[] = [
    "JWT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "API_BASE_URL",
    "WEB_BASE_URL",
  ]

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
}

const createApp = (env: Env) => {
  // 起動時に環境変数をバリデーション
  validateEnv(env)

  const db = createDb(env.DB)

  // レート制限ストアの作成
  // local: インメモリ（モジュールスコープで永続化）
  // staging/production: Durable Objects
  const rateLimitStore =
    env.ENVIRONMENT === "local"
      ? (memoryStore ??= createRateLimitStore({ type: "memory" }))
      : createRateLimitStore({ type: "durable-object", namespace: env.RATE_LIMITER })

  const limiter = createRateLimiterFactory<{ Bindings: Env; Variables: Variables }>(
    rateLimitStore
  )

  // CORS設定
  const corsMiddleware = cors({
    origin: (origin) => {
      // ローカル環境: localhost, 127.0.0.1, プライベートIP を許可
      if (env.ENVIRONMENT === "local") {
        if (!origin) return origin // 同一オリジンリクエスト
        const url = new URL(origin)
        const host = url.hostname
        if (
          host === "localhost" ||
          host === "127.0.0.1" ||
          host.startsWith("192.168.") ||
          host.startsWith("10.") ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host)
        ) {
          return origin // リクエスト元をそのまま許可
        }
      }
      // staging/production: WEB_BASE_URL のみ許可
      return env.WEB_BASE_URL
    },
    credentials: true,
  })

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // ローカル環境のみ詳細ログを出力
    .use("*", async (c, next) => {
      if (env.ENVIRONMENT === "local") {
        return logger()(c, next)
      }
      return next()
    })
    .use("*", secureHeaders())
    .use("*", corsMiddleware)
    // レート制限（より具体的なパスを先に定義）
    // 認証系は厳格（5 req/min）
    .use("/api/auth/*", limiter.strict())
    // AI系は中程度（20 req/min）
    .use("/api/chat/sessions/*/messages", limiter.moderate())
    .use("/api/images/*/ocr", limiter.moderate())
    .use("/api/notes", limiter.moderate())
    // その他は緩め（100 req/min）
    // rateLimitApplied フラグにより、上記で適用済みの場合はスキップされる
    .use("/api/*", limiter.lenient())
    .route("/api/auth", createAuthFeature(env, db))
    .route("/api/chat", createChatFeature(env, db))
    .route("/api/notes", createNoteFeature(env, db))
    .route("/api/images", createImageFeature(env, db))
    .route("/api/metrics", createMetricsFeature(env, db))
    .route("/api/study-domains", createStudyDomainFeature(env, db))
    .route("/api/subjects", createSubjectFeature(env, db))
    .route("/api/bookmarks", createBookmarkFeature(env, db))
    .route("/api/learning", createLearningFeature(env, db))
    .route("/api/view", createViewFeature(env, db))
    .get("/api/health", (c) => c.json({ status: "ok" }))
    .onError((error, c) => {
      // ローカル環境では詳細なエラー情報を出力
      if (env.ENVIRONMENT === "local") {
        console.error(`[${new Date().toISOString()}] [UNHANDLED ERROR]`)
        console.error(`  Path: ${c.req.path}`)
        console.error(`  Method: ${c.req.method}`)
        if (error instanceof Error) {
          console.error(`  Name: ${error.name}`)
          console.error(`  Message: ${error.message}`)
          if (error.stack) {
            console.error(`  Stack:`)
            error.stack.split("\n").forEach((line) => {
              console.error(`    ${line}`)
            })
          }
          if (error.cause) {
            console.error(`  Cause:`, error.cause)
          }
        } else {
          console.error(`  Error:`, error)
        }
      }
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Internal Server Error",
            ...(env.ENVIRONMENT === "local" &&
              error instanceof Error && {
                details: { name: error.name, path: c.req.path },
              }),
          },
        },
        500
      )
    })

  return app
}

export type AppType = ReturnType<typeof createApp>

export default {
  fetch: (request: Request, env: Env) => createApp(env).fetch(request, env),
}
