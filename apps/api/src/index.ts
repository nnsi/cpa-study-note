import { Hono } from "hono"
import { cors } from "hono/cors"
import { createDb } from "@cpa-study/db"
import { createAuthFeature } from "./features/auth"
import { createTopicFeature } from "./features/topic"
import { createChatFeature } from "./features/chat"
import { createNoteFeature } from "./features/note"
import { createImageFeature } from "./features/image"
import type { Env, Variables } from "./shared/types/env"

const createApp = (env: Env) => {
  const db = createDb(env.DB)

  // CORS設定: localは全許可、staging/productionはWEB_BASE_URLのみ許可
  const corsMiddleware =
    env.ENVIRONMENT === "local"
      ? cors()
      : cors({
          origin: env.WEB_BASE_URL,
          credentials: true,
        })

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
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
