import { Hono } from "hono"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { createDb } from "@cpa-study/db"
import { createAuthFeature } from "./features/auth"
import { createTopicFeature } from "./features/topic"
import { createChatFeature } from "./features/chat"
import { createNoteFeature } from "./features/note"
import { createImageFeature } from "./features/image"
import type { Env, Variables } from "./shared/types/env"

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
    .use("*", secureHeaders())
    .use("*", corsMiddleware)
    .route("/api/auth", createAuthFeature(env, db))
    .route("/api/subjects", createTopicFeature(env, db))
    .route("/api/chat", createChatFeature(env, db))
    .route("/api/notes", createNoteFeature(env, db))
    .route("/api/images", createImageFeature(env, db))
    .get("/api/health", (c) => c.json({ status: "ok" }))

  return app
}

export type AppType = ReturnType<typeof createApp>

export default {
  fetch: (request: Request, env: Env) => createApp(env).fetch(request, env),
}
