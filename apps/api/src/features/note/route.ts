import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, resolveAIConfig } from "@/shared/lib/ai"
import { createNoteRepository } from "./repository"
import { createChatRepository } from "../chat/repository"
import { createSubjectRepository } from "../subject/repository"
import {
  createNoteFromSessionRequestSchema,
  createManualNoteRequestSchema,
  updateNoteRequestSchema,
} from "@cpa-study/shared/schemas"
import {
  createNoteFromSession,
  createManualNote,
  listNotes,
  listNotesByTopic,
  getNote,
  getNoteBySession,
  updateNote,
  refreshNoteFromSession,
} from "./usecase"
import { handleResultWith, errorResponse } from "@/shared/lib/route-helpers"

type NoteDeps = {
  env: Env
  db: Db
}

export const noteRoutes = ({ env, db }: NoteDeps) => {
  const noteRepo = createNoteRepository(db)
  const chatRepo = createChatRepository(db)
  const subjectRepo = createSubjectRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // ノート作成（セッションから）
    .post(
      "/",
      authMiddleware,
      zValidator("json", createNoteFromSessionRequestSchema),
      async (c) => {
        const user = c.get("user")
        const { sessionId } = c.req.valid("json")

        const aiAdapter = createAIAdapter({
          provider: env.AI_PROVIDER,
          apiKey: env.OPENROUTER_API_KEY,
        })

        const result = await createNoteFromSession(
          { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: aiConfig.noteSummary },
          { userId: user.id, sessionId }
        )

        return handleResultWith(c, result, (note) => ({ note }), 201)
      }
    )

    // 独立ノート作成（手動）
    .post(
      "/manual",
      authMiddleware,
      zValidator("json", createManualNoteRequestSchema),
      async (c) => {
        const user = c.get("user")
        const body = c.req.valid("json")

        const result = await createManualNote(
          { noteRepo, subjectRepo },
          {
            userId: user.id,
            topicId: body.topicId,
            userMemo: body.userMemo,
            keyPoints: body.keyPoints,
            stumbledPoints: body.stumbledPoints,
          }
        )

        return handleResultWith(c, result, (note) => ({ note }), 201)
      }
    )

    // ノート一覧
    .get("/", authMiddleware, async (c) => {
      const user = c.get("user")
      const result = await listNotes({ noteRepo }, user.id)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ notes: result.value })
    })

    // 論点別ノート一覧
    .get("/topic/:topicId", authMiddleware, async (c) => {
      const user = c.get("user")
      const topicId = c.req.param("topicId")
      const result = await listNotesByTopic({ noteRepo }, user.id, topicId)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ notes: result.value })
    })

    // セッション別ノート取得
    .get("/session/:sessionId", authMiddleware, async (c) => {
      const user = c.get("user")
      const sessionId = c.req.param("sessionId")
      const result = await getNoteBySession({ noteRepo }, user.id, sessionId)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ note: result.value })
    })

    // ノート詳細
    .get("/:noteId", authMiddleware, async (c) => {
      const user = c.get("user")
      const noteId = c.req.param("noteId")

      const result = await getNote({ noteRepo }, user.id, noteId)
      return handleResultWith(c, result, (note) => ({ note }))
    })

    // ノート更新
    .put(
      "/:noteId",
      authMiddleware,
      zValidator("json", updateNoteRequestSchema),
      async (c) => {
        const user = c.get("user")
        const noteId = c.req.param("noteId")
        const body = c.req.valid("json")

        const result = await updateNote({ noteRepo }, user.id, noteId, body)
        return handleResultWith(c, result, (note) => ({ note }))
      }
    )

    // ノート再生成（最新の会話を反映）
    .post("/:noteId/refresh", authMiddleware, async (c) => {
      const user = c.get("user")
      const noteId = c.req.param("noteId")

      const aiAdapter = createAIAdapter({
        provider: env.AI_PROVIDER,
        apiKey: env.OPENROUTER_API_KEY,
      })

      const result = await refreshNoteFromSession(
        { noteRepo, chatRepo, aiAdapter, noteSummaryConfig: aiConfig.noteSummary },
        user.id,
        noteId
      )

      return handleResultWith(c, result, (note) => ({ note }))
    })

  return app
}
