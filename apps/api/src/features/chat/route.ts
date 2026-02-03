import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { createSessionRequestSchema, sendMessageRequestSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, streamToSSE, resolveAIConfig } from "@/shared/lib/ai"
import { createChatRepository } from "./repository"
import { createLearningRepository } from "../learning/repository"
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
import { handleResult, errorResponse } from "@/shared/lib/route-helpers"

type ChatDeps = {
  env: Env
  db: Db
}

export const chatRoutes = ({ env, db }: ChatDeps) => {
  const chatRepo = createChatRepository(db)
  const learningRepo = createLearningRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // セッション作成
    .post(
      "/sessions",
      authMiddleware,
      zValidator("json", createSessionRequestSchema),
      async (c) => {
        const user = c.get("user")
        const { topicId } = c.req.valid("json")

        const result = await createSession(
          { chatRepo, learningRepo },
          user.id,
          topicId
        )

        if (!result.ok) return errorResponse(c, result.error)
        return c.json({ session: result.value }, 201)
      }
    )

    // 論点ごとのセッション一覧
    .get(
      "/topics/:topicId/sessions",
      authMiddleware,
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")

        const result = await listSessionsByTopic({ chatRepo }, user.id, topicId)

        if (!result.ok) return errorResponse(c, result.error)
        return c.json({ sessions: result.value })
      }
    )

    // 論点ごとのgood質問一覧（N+1解消用バッチ取得）
    .get(
      "/topics/:topicId/good-questions",
      authMiddleware,
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")

        const result = await listGoodQuestionsByTopic({ chatRepo }, user.id, topicId)

        if (!result.ok) return errorResponse(c, result.error)
        return c.json({ questions: result.value })
      }
    )

    // セッション取得
    .get("/sessions/:sessionId", authMiddleware, async (c) => {
      const sessionId = c.req.param("sessionId")
      const user = c.get("user")

      const result = await getSession({ chatRepo }, user.id, sessionId)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ session: result.value })
    })

    // メッセージ一覧
    .get("/sessions/:sessionId/messages", authMiddleware, async (c) => {
      const sessionId = c.req.param("sessionId")
      const user = c.get("user")

      const result = await listMessages({ chatRepo }, user.id, sessionId)
      if (!result.ok) return errorResponse(c, result.error)
      return c.json({ messages: result.value })
    })

    // メッセージ送信（ストリーミング）
    .post(
      "/sessions/:sessionId/messages/stream",
      authMiddleware,
      zValidator("json", sendMessageRequestSchema),
      async (c) => {
        const sessionId = c.req.param("sessionId")
        const user = c.get("user")
        const { content, imageId, ocrResult } = c.req.valid("json")

        const aiAdapter = createAIAdapter({
          provider: env.AI_PROVIDER,
          apiKey: env.OPENROUTER_API_KEY,
        })

        const stream = sendMessage(
          { chatRepo, learningRepo, aiAdapter, aiConfig },
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
      zValidator("json", sendMessageRequestSchema),
      async (c) => {
        const topicId = c.req.param("topicId")
        const user = c.get("user")
        const { content, imageId, ocrResult } = c.req.valid("json")

        const aiAdapter = createAIAdapter({
          provider: env.AI_PROVIDER,
          apiKey: env.OPENROUTER_API_KEY,
        })

        const stream = sendMessageWithNewSession(
          { chatRepo, learningRepo, aiAdapter, aiConfig },
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

      const evalResult = await evaluateQuestion(
        { chatRepo, learningRepo, aiAdapter, aiConfig },
        messageId,
        result.value
      )

      if (!evalResult.ok) return errorResponse(c, evalResult.error)
      return c.json({ quality: evalResult.value })
    })

  return app
}
