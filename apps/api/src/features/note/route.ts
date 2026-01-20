import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter } from "@/shared/lib/ai"
import { createNoteRepository } from "./repository"
import { createChatRepository } from "../chat/repository"
import {
  createNoteFromSession,
  listNotes,
  listNotesByTopic,
  getNote,
  updateNote,
} from "./usecase"

type NoteDeps = {
  env: Env
  db: Db
}

export const noteRoutes = ({ env, db }: NoteDeps) => {
  const noteRepo = createNoteRepository(db)
  const chatRepo = createChatRepository(db)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // ノート作成（セッションから）
    .post(
      "/",
      authMiddleware,
      zValidator("json", z.object({ sessionId: z.string() })),
      async (c) => {
        const user = c.get("user")
        const { sessionId } = c.req.valid("json")

        const aiAdapter = createAIAdapter({
          provider: env.AI_PROVIDER as "mock" | "vercel-ai",
          apiKey: env.OPENROUTER_API_KEY,
        })

        const result = await createNoteFromSession(
          { noteRepo, chatRepo, aiAdapter },
          { userId: user.id, sessionId }
        )

        if (!result.ok) {
          return c.json({ error: result.error }, result.status as 404 | 403)
        }

        return c.json({ note: result.note }, 201)
      }
    )

    // ノート一覧
    .get("/", authMiddleware, async (c) => {
      const user = c.get("user")
      const notes = await listNotes({ noteRepo }, user.id)
      return c.json({ notes })
    })

    // 論点別ノート一覧
    .get("/topic/:topicId", authMiddleware, async (c) => {
      const user = c.get("user")
      const topicId = c.req.param("topicId")
      const notes = await listNotesByTopic({ noteRepo }, user.id, topicId)
      return c.json({ notes })
    })

    // ノート詳細
    .get("/:noteId", authMiddleware, async (c) => {
      const user = c.get("user")
      const noteId = c.req.param("noteId")

      const result = await getNote({ noteRepo }, user.id, noteId)

      if (!result.ok) {
        return c.json({ error: result.error }, result.status as 404 | 403)
      }

      return c.json({ note: result.note })
    })

    // ノート更新
    .put(
      "/:noteId",
      authMiddleware,
      zValidator(
        "json",
        z.object({
          userMemo: z.string().optional(),
          keyPoints: z.array(z.string()).optional(),
          stumbledPoints: z.array(z.string()).optional(),
        })
      ),
      async (c) => {
        const user = c.get("user")
        const noteId = c.req.param("noteId")
        const body = c.req.valid("json")

        const result = await updateNote({ noteRepo }, user.id, noteId, body)

        if (!result.ok) {
          return c.json({ error: result.error }, result.status as 404 | 403)
        }

        return c.json({ note: result.note })
      }
    )

  return app
}
