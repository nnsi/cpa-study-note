import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { createSessionRequestSchema, sendMessageRequestSchema, correctSpeechRequestSchema } from "@cpa-study/shared/schemas"
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
  sendMessage,
  sendMessageWithNewSession,
  evaluateQuestion,
  listGoodQuestionsByTopic,
  correctSpeechText,
} from "./usecase"
import { handleResult } from "@/shared/lib/route-helpers"

type ChatDeps = {
  env: Env
  db: Db
}

export const chatRoutes = ({ env, db }: ChatDeps) => {
  const chatRepo = createChatRepository(db)
  const learningRepo = createLearningRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)
  const aiAdapter = createAIAdapter({
    provider: env.AI_PROVIDER,
    apiKey: env.OPENROUTER_API_KEY,
  })

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

        return handleResult(c, result, "session", 201)
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
        return handleResult(c, result, "sessions")
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
        return handleResult(c, result, "questions")
      }
    )

    // セッション取得
    .get("/sessions/:sessionId", authMiddleware, async (c) => {
      const sessionId = c.req.param("sessionId")
      const user = c.get("user")

      const result = await getSession({ chatRepo }, user.id, sessionId)
      return handleResult(c, result, "session")
    })

    // メッセージ一覧
    .get("/sessions/:sessionId/messages", authMiddleware, async (c) => {
      const sessionId = c.req.param("sessionId")
      const user = c.get("user")

      const result = await listMessages({ chatRepo }, user.id, sessionId)
      return handleResult(c, result, "messages")
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

    // 音声認識テキスト補正
    .post(
      "/correct-speech",
      authMiddleware,
      zValidator("json", correctSpeechRequestSchema),
      async (c) => {
        const { text } = c.req.valid("json")

        const result = await correctSpeechText(
          { aiAdapter, aiConfig },
          text
        )

        return handleResult(c, result, "correctedText")
      }
    )

    // 質問評価
    .post("/messages/:messageId/evaluate", authMiddleware, async (c) => {
      const messageId = c.req.param("messageId")
      const user = c.get("user")

      const evalResult = await evaluateQuestion(
        { chatRepo, learningRepo, aiAdapter, aiConfig },
        user.id,
        messageId,
      )

      return handleResult(c, evalResult, "quality")
    })

  return app
}
