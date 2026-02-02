import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, streamToSSE, resolveAIConfig } from "@/shared/lib/ai"
import { createChatRepository } from "./repository"
import { createSubjectRepository } from "../subject/repository"
import {
  createSession,
  getSession,
  listSessionsByTopic,
  listMessages,
  getMessageForEvaluation,
  sendMessage,
  sendMessageWithNewSession,
  evaluateQuestion,
  listGoodQuestionsByTopic,
} from "./usecase"
import { handleResult, handleResultWith } from "@/shared/lib/route-helpers"

type ChatDeps = {
  env: Env
  db: Db
}

export const chatRoutes = ({ env, db }: ChatDeps) => {
  const chatRepo = createChatRepository(db)
  const subjectRepo = createSubjectRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // セッション作成
    .post(
      "/sessions",
      authMiddleware,
      zValidator("json", z.object({ topicId: z.string() })),
      async (c) => {
        const user = c.get("user")
        const { topicId } = c.req.valid("json")

        const result = await createSession(
          { chatRepo, subjectRepo },
          user.id,
          topicId
        )

        return handleResultWith(c, result, (session) => ({ session }), 201)
      }
    )

    // 論点ごとのセッション一覧
    .get(
      "/topics/:topicId/sessions",
      authMiddleware,
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")

        const sessions = await listSessionsByTopic({ chatRepo }, user.id, topicId)

        return c.json({ sessions })
      }
    )

    // 論点ごとのgood質問一覧（N+1解消用バッチ取得）
    .get(
      "/topics/:topicId/good-questions",
      authMiddleware,
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")

        const questions = await listGoodQuestionsByTopic({ chatRepo }, user.id, topicId)

        return c.json({ questions })
      }
    )

    // セッション取得
    .get("/sessions/:sessionId", authMiddleware, async (c) => {
      const sessionId = c.req.param("sessionId")
      const user = c.get("user")

      const result = await getSession({ chatRepo }, user.id, sessionId)
      return handleResultWith(c, result, (session) => ({ session }))
    })

    // メッセージ一覧
    .get("/sessions/:sessionId/messages", authMiddleware, async (c) => {
      const sessionId = c.req.param("sessionId")
      const user = c.get("user")

      const result = await listMessages({ chatRepo }, user.id, sessionId)
      return handleResultWith(c, result, (messages) => ({ messages }))
    })

    // メッセージ送信（ストリーミング）
    .post(
      "/sessions/:sessionId/messages/stream",
      authMiddleware,
      zValidator(
        "json",
        z.object({
          content: z.string().min(1).max(10000),
          imageId: z.string().optional(),
          ocrResult: z.string().max(50000).optional(),
        })
      ),
      async (c) => {
        const sessionId = c.req.param("sessionId")
        const user = c.get("user")
        const { content, imageId, ocrResult } = c.req.valid("json")

        const aiAdapter = createAIAdapter({
          provider: env.AI_PROVIDER,
          apiKey: env.OPENROUTER_API_KEY,
        })

        const stream = sendMessage(
          { chatRepo, subjectRepo, aiAdapter, aiConfig },
          {
            sessionId,
            userId: user.id,
            content,
            imageId,
            ocrResult,
          }
        )

        return streamToSSE(c, stream)
      }
    )

    // 新規セッション + メッセージ送信（最初のメッセージ送信時にセッションを作成）
    .post(
      "/topics/:topicId/messages/stream",
      authMiddleware,
      zValidator(
        "json",
        z.object({
          content: z.string().min(1).max(10000),
          imageId: z.string().optional(),
          ocrResult: z.string().max(50000).optional(),
        })
      ),
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")
        const { content, imageId, ocrResult } = c.req.valid("json")

        const aiAdapter = createAIAdapter({
          provider: env.AI_PROVIDER,
          apiKey: env.OPENROUTER_API_KEY,
        })

        const stream = sendMessageWithNewSession(
          { chatRepo, subjectRepo, aiAdapter, aiConfig },
          {
            topicId,
            userId: user.id,
            content,
            imageId,
            ocrResult,
          }
        )

        return streamToSSE(c, stream)
      }
    )

    // 質問評価
    .post("/messages/:messageId/evaluate", authMiddleware, async (c) => {
      const messageId = c.req.param("messageId")
      const user = c.get("user")

      const result = await getMessageForEvaluation({ chatRepo }, user.id, messageId)

      if (!result.ok) {
        return handleResult(c, result)
      }

      const aiAdapter = createAIAdapter({
        provider: env.AI_PROVIDER,
        apiKey: env.OPENROUTER_API_KEY,
      })

      const quality = await evaluateQuestion(
        { chatRepo, subjectRepo, aiAdapter, aiConfig },
        messageId,
        result.value
      )

      return c.json({ quality })
    })

  return app
}
