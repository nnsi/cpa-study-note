import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { confirmExerciseRequestSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, resolveAIConfig } from "@/shared/lib/ai"
import { createExerciseRepository } from "./repository"
import { createImageRepository } from "../image/repository"
import { analyzeExercise, confirmExercise, getTopicExercises } from "./usecase"
import { handleResult, handleResultWith } from "@/shared/lib/route-helpers"
import { payloadTooLarge, badRequest } from "@/shared/lib/errors"
import { err } from "@/shared/lib/result"

// 10MB制限
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

// 許可するMIMEタイプ
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

type ExerciseDeps = {
  env: Env
  db: Db
}

export const exerciseRoutes = ({ env, db }: ExerciseDeps) => {
  const exerciseRepo = createExerciseRepository(db)
  const imageRepo = createImageRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // 画像分析（アップロード + OCR + 論点推測）
    .post("/analyze", authMiddleware, async (c) => {
      const user = c.get("user")

      // multipart/form-data から画像を取得
      const formData = await c.req.formData()
      const imageFile = formData.get("image")

      if (!imageFile || typeof imageFile === "string") {
        return handleResult(c, err(badRequest("画像ファイルが必要です")))
      }

      // FormDataの値がBlobかどうかをチェック
      const file = imageFile as unknown as { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }
      if (!file.arrayBuffer || !file.type || !file.size) {
        return handleResult(c, err(badRequest("画像ファイルが必要です")))
      }

      // MIMEタイプチェック
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return handleResult(
          c,
          err(badRequest("許可されていないファイル形式です（JPEG, PNG, GIF, WebPのみ）"))
        )
      }

      // サイズチェック
      if (file.size > MAX_UPLOAD_SIZE) {
        return handleResult(c, err(payloadTooLarge("ファイルサイズが大きすぎます（最大10MB）")))
      }

      const imageData = await file.arrayBuffer()

      const aiAdapter = createAIAdapter({
        provider: env.AI_PROVIDER,
        apiKey: env.OPENROUTER_API_KEY,
      })

      const result = await analyzeExercise(
        { exerciseRepo, imageRepo, aiAdapter, aiConfig, r2: env.R2 },
        user.id,
        file.name || "image",
        file.type,
        imageData
      )

      return handleResult(c, result)
    })

    // 論点確定
    .post(
      "/:exerciseId/confirm",
      authMiddleware,
      zValidator("json", confirmExerciseRequestSchema),
      async (c) => {
        const user = c.get("user")
        const exerciseId = c.req.param("exerciseId")
        const { topicId, markAsUnderstood } = c.req.valid("json")

        const result = await confirmExercise(
          { exerciseRepo },
          user.id,
          exerciseId,
          topicId,
          markAsUnderstood
        )

        return handleResult(c, result)
      }
    )

    // 論点に紐づく問題一覧
    .get("/topics/:topicId", authMiddleware, async (c) => {
      const user = c.get("user")
      const topicId = c.req.param("topicId")

      const result = await getTopicExercises({ exerciseRepo }, user.id, topicId)

      return handleResultWith(c, result, (data) => data)
    })

  return app
}
