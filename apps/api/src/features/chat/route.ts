import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, streamToSSE } from "@/shared/lib/ai"
import { createChatRepository } from "./repository"
import { createTopicRepository } from "../topic/repository"
import {
  createSession,
  getSession,
  listMessages,
  getMessageForEvaluation,
  sendMessage,
  evaluateQuestion,
} from "./usecase"

type ChatDeps = {
  env: Env
  db: Db
}

export const chatRoutes = ({ env, db }: ChatDeps) => {
  const chatRepo = createChatRepository(db)
  const topicRepo = createTopicRepository(db)

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
          { chatRepo, topicRepo },
          user.id,
          topicId
        )

        if (!result.ok) {
          return c.json({ error: result.error }, result.status as 404)
        }

        return c.json({ session: result.session }, 201)
      }
    )

    // セッション取得
    .get("/sessions/:sessionId", authMiddleware, async (c) => {
      const sessionId = c.req.param("sessionId")
      const user = c.get("user")

      const result = await getSession({ chatRepo }, user.id, sessionId)

      if (!result.ok) {
        return c.json({ error: result.error }, result.status as 404 | 403)
      }

      return c.json({ session: result.session })
    })

    // メッセージ一覧
    .get("/sessions/:sessionId/messages", authMiddleware, async (c) => {
      const sessionId = c.req.param("sessionId")
      const user = c.get("user")

      const result = await listMessages({ chatRepo }, user.id, sessionId)

      if (!result.ok) {
        return c.json({ error: result.error }, result.status as 404 | 403)
      }

      return c.json({ messages: result.messages })
    })

    // メッセージ送信（ストリーミング）
    .post(
      "/sessions/:sessionId/messages/stream",
      authMiddleware,
      zValidator(
        "json",
        z.object({
          content: z.string().min(1),
          imageId: z.string().optional(),
          ocrResult: z.string().optional(),
        })
      ),
      async (c) => {
        const sessionId = c.req.param("sessionId")
        const user = c.get("user")
        const { content, imageId, ocrResult } = c.req.valid("json")

        const aiAdapter = createAIAdapter({
          provider: env.AI_PROVIDER as "mock" | "vercel-ai",
          apiKey: env.OPENROUTER_API_KEY,
        })

        const stream = sendMessage(
          { chatRepo, topicRepo, aiAdapter },
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

    // 質問評価
    .post("/messages/:messageId/evaluate", authMiddleware, async (c) => {
      const messageId = c.req.param("messageId")

      const message = await getMessageForEvaluation({ chatRepo }, messageId)

      if (!message) {
        return c.json({ error: "Message not found" }, 404)
      }

      const aiAdapter = createAIAdapter({
        provider: env.AI_PROVIDER as "mock" | "vercel-ai",
        apiKey: env.OPENROUTER_API_KEY,
      })

      const quality = await evaluateQuestion(
        { chatRepo, topicRepo, aiAdapter },
        messageId,
        message.content
      )

      return c.json({ quality })
    })

  return app
}
