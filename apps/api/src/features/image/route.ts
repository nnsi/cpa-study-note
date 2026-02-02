import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import type { Db } from "@cpa-study/db"
import { uploadImageRequestSchema } from "@cpa-study/shared/schemas"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAIAdapter, resolveAIConfig } from "@/shared/lib/ai"
import { createImageRepository } from "./repository"
import {
  createUploadUrl,
  uploadImage,
  performOCR,
  getImage,
  getImageFile,
} from "./usecase"
import { handleResult, handleResultWith } from "@/shared/lib/route-helpers"

// 10MB制限
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

type ImageDeps = {
  env: Env
  db: Db
}

export const imageRoutes = ({ env, db }: ImageDeps) => {
  const imageRepo = createImageRepository(db)
  const aiConfig = resolveAIConfig(env.ENVIRONMENT)

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // アップロードURL取得
    .post(
      "/upload-url",
      authMiddleware,
      zValidator("json", uploadImageRequestSchema),
      async (c) => {
        const user = c.get("user")
        const { filename, mimeType } = c.req.valid("json")

        const result = await createUploadUrl(
          { imageRepo, apiBaseUrl: env.API_BASE_URL },
          { userId: user.id, filename, mimeType }
        )

        return c.json(result)
      }
    )

    // 画像アップロード（直接）
    .post("/:imageId/upload", authMiddleware, async (c) => {
      const user = c.get("user")
      const imageId = c.req.param("imageId")
      const body = await c.req.arrayBuffer()

      // サイズ制限チェック
      if (body.byteLength > MAX_UPLOAD_SIZE) {
        return c.json({ error: { code: "BAD_REQUEST", message: "ファイルサイズが大きすぎます（最大10MB）" } }, 413)
      }

      const result = await uploadImage(
        { imageRepo, r2: env.R2 },
        user.id,
        imageId,
        body
      )

      if (!result.ok) {
        return handleResult(c, result)
      }

      return c.json({ success: true })
    })

    // OCR実行
    .post("/:imageId/ocr", authMiddleware, async (c) => {
      const user = c.get("user")
      const imageId = c.req.param("imageId")

      const aiAdapter = createAIAdapter({
        provider: env.AI_PROVIDER,
        apiKey: env.OPENROUTER_API_KEY,
      })

      const result = await performOCR(
        { imageRepo, aiAdapter, aiConfig, r2: env.R2 },
        user.id,
        imageId
      )

      return handleResult(c, result)
    })

    // 画像取得
    .get("/:imageId", authMiddleware, async (c) => {
      const user = c.get("user")
      const imageId = c.req.param("imageId")

      const result = await getImage({ imageRepo }, user.id, imageId)
      return handleResultWith(c, result, (image) => ({ image }))
    })

    // 画像ファイル取得（バイナリ）
    .get("/:imageId/file", authMiddleware, async (c) => {
      const user = c.get("user")
      const imageId = c.req.param("imageId")

      const result = await getImageFile(
        { imageRepo, r2: env.R2 },
        user.id,
        imageId
      )

      if (!result.ok) {
        return handleResult(c, result)
      }

      return new Response(result.value.body, {
        headers: {
          "Content-Type": result.value.mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      })
    })

  return app
}
