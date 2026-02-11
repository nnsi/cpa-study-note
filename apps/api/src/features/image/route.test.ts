/// <reference types="@cloudflare/workers-types" />
/**
 * Image Routes の統合テスト
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { imageRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  createAdditionalTestData,
  createImageTestData,
  parseJson,
  errorResponseSchema,
  type TestContext,
} from "../../test/helpers"
import { mockAIPresets } from "../../test/mocks/ai"

// レスポンススキーマ定義
const uploadUrlResponseSchema = z.object({
  uploadUrl: z.string(),
  imageId: z.string(),
})

const imageMetadataResponseSchema = z.object({
  image: z.object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    r2Key: z.string(),
    ocrText: z.string().nullable(),
    createdAt: z.string(),
  }),
})

const ocrResultResponseSchema = z.object({
  imageId: z.string(),
  ocrText: z.string(),
})

// AI Adapterをモック
vi.mock("../../shared/lib/ai", () => ({
  createAIAdapter: () => mockAIPresets.ocr,
  resolveAIConfig: () => ({
    chat: { model: "test-model", temperature: 0.7, maxTokens: 2000 },
    evaluation: { model: "test-model", temperature: 0, maxTokens: 100 },
    noteSummary: { model: "test-model", temperature: 0.3, maxTokens: 1000 },
    ocr: { model: "openai/gpt-4o-mini", temperature: 0, maxTokens: 2000 },
    speechCorrection: { model: "test-model", temperature: 0, maxTokens: 500 },
    topicGenerator: { model: "test-model", temperature: 0.5, maxTokens: 3000 },
    planAssistant: { model: "test-model", temperature: 0.5, maxTokens: 3000 },
    quickChatSuggest: { model: "test-model", temperature: 0, maxTokens: 500 },
  }),
}))

describe("Image Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let additionalData: ReturnType<typeof createAdditionalTestData>

  beforeEach(() => {
    ctx = setupTestContext()
    additionalData = createAdditionalTestData(ctx.db, ctx.testData)

    // ルートを作成
    const routes = imageRoutes({ env: ctx.env, db: ctx.db as any })

    // メインアプリにマウント（環境変数を初期化）
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.route("/images", routes)
  })

  describe("POST /images/upload-url - アップロードURL取得", () => {
    it("アップロードURLとimageIdを取得できる", async () => {
      const res = await app.request("/images/upload-url", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          filename: "test-image.png",
          mimeType: "image/png",
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, uploadUrlResponseSchema)
      expect(body.uploadUrl).toBeDefined()
      expect(body.imageId).toBeDefined()
      expect(body.uploadUrl).toContain(body.imageId)
    })

    it("許可されていないMIMEタイプは400を返す", async () => {
      const res = await app.request("/images/upload-url", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          filename: "test.txt",
          mimeType: "text/plain",
        }),
      })

      expect(res.status).toBe(400)
    })

    it("JPEGファイルのアップロードURLを取得できる", async () => {
      const res = await app.request("/images/upload-url", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          filename: "photo.jpg",
          mimeType: "image/jpeg",
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, uploadUrlResponseSchema)
      expect(body.uploadUrl).toBeDefined()
    })

    it("GIFファイルのアップロードURLを取得できる", async () => {
      const res = await app.request("/images/upload-url", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          filename: "animation.gif",
          mimeType: "image/gif",
        }),
      })

      expect(res.status).toBe(200)
    })

    it("WebPファイルのアップロードURLを取得できる", async () => {
      const res = await app.request("/images/upload-url", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          filename: "image.webp",
          mimeType: "image/webp",
        }),
      })

      expect(res.status).toBe(200)
    })

    it("filenameは255文字以内である必要がある", async () => {
      const longFilename = "a".repeat(256) + ".png"
      const res = await app.request("/images/upload-url", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          filename: longFilename,
          mimeType: "image/png",
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe("POST /images/:imageId/upload - 画像アップロード", () => {
    // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47
    const createPngBuffer = () => {
      const buffer = new ArrayBuffer(100)
      const view = new Uint8Array(buffer)
      // PNG magic bytes
      view[0] = 0x89
      view[1] = 0x50
      view[2] = 0x4e
      view[3] = 0x47
      return buffer
    }

    it("画像をアップロードできる", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)

      const res = await app.request(`/images/${imageId}/upload`, {
        method: "POST",
        headers: {
          ...createAuthHeaders(ctx.testData.userId),
          "Content-Type": "application/octet-stream",
        },
        body: createPngBuffer(),
      })

      expect(res.status).toBe(204)
    })

    it("存在しない画像IDは404を返す", async () => {
      const res = await app.request("/images/non-existent-image/upload", {
        method: "POST",
        headers: {
          ...createAuthHeaders(ctx.testData.userId),
          "Content-Type": "application/octet-stream",
        },
        body: createPngBuffer(),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("画像が見つかりません")
    })

    it("他ユーザーの画像にアップロードしようとすると403を返す", async () => {
      const { imageId } = createImageTestData(ctx.db, additionalData.otherUserId)

      const res = await app.request(`/images/${imageId}/upload`, {
        method: "POST",
        headers: {
          ...createAuthHeaders(ctx.testData.userId),
          "Content-Type": "application/octet-stream",
        },
        body: createPngBuffer(),
      })

      expect(res.status).toBe(403)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("この画像へのアクセス権限がありません")
    })

    it("マジックバイトが一致しないファイルは400を返す", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)

      // 不正なマジックバイト（テキストファイル）
      const textData = new TextEncoder().encode("This is not an image")
      const invalidBuffer = new ArrayBuffer(textData.byteLength)
      new Uint8Array(invalidBuffer).set(textData)

      const res = await app.request(`/images/${imageId}/upload`, {
        method: "POST",
        headers: {
          ...createAuthHeaders(ctx.testData.userId),
          "Content-Type": "application/octet-stream",
        },
        body: invalidBuffer,
      })

      expect(res.status).toBe(400)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("ファイル形式が不正です")
    })

    it("10MBを超えるファイルは413を返す", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)

      // 11MBのバッファ
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024)
      const view = new Uint8Array(largeBuffer)
      // PNG magic bytes
      view[0] = 0x89
      view[1] = 0x50
      view[2] = 0x4e
      view[3] = 0x47

      const res = await app.request(`/images/${imageId}/upload`, {
        method: "POST",
        headers: {
          ...createAuthHeaders(ctx.testData.userId),
          "Content-Type": "application/octet-stream",
        },
        body: largeBuffer,
      })

      expect(res.status).toBe(413)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toContain("10MB")
    })
  })

  describe("POST /images/:imageId/ocr - OCR実行", () => {
    it("OCRを実行して結果を取得できる", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)

      // R2に画像をアップロード
      const pngBuffer = new ArrayBuffer(100)
      const view = new Uint8Array(pngBuffer)
      view[0] = 0x89
      view[1] = 0x50
      view[2] = 0x4e
      view[3] = 0x47
      await ctx.r2.put(`images/${imageId}/test.png`, pngBuffer)

      const res = await app.request(`/images/${imageId}/ocr`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, ocrResultResponseSchema)
      expect(body.imageId).toBe(imageId)
      expect(body.ocrText).toBeDefined()
    })

    it("存在しない画像IDは404を返す", async () => {
      const res = await app.request("/images/non-existent-image/ocr", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("画像が見つかりません")
    })

    it("他ユーザーの画像のOCRを実行しようとすると403を返す", async () => {
      const { imageId } = createImageTestData(ctx.db, additionalData.otherUserId)

      const res = await app.request(`/images/${imageId}/ocr`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(403)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("この画像へのアクセス権限がありません")
    })

    it("R2にファイルがない場合は404を返す", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)
      // R2にアップロードしない

      const res = await app.request(`/images/${imageId}/ocr`, {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("画像ファイルが見つかりません")
    })
  })

  describe("GET /images/:imageId - 画像メタデータ取得", () => {
    it("画像メタデータを取得できる", async () => {
      const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)

      const res = await app.request(`/images/${imageId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, imageMetadataResponseSchema)
      expect(body.image).toBeDefined()
      expect(body.image.id).toBe(imageId)
      expect(body.image.filename).toBe("test.png")
      expect(body.image.mimeType).toBe("image/png")
      expect(body.image.size).toBe(1024)
    })

    it("存在しない画像IDは404を返す", async () => {
      const res = await app.request("/images/non-existent-image", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("画像が見つかりません")
    })

    it("他ユーザーの画像メタデータにアクセスすると403を返す", async () => {
      const { imageId } = createImageTestData(ctx.db, additionalData.otherUserId)

      const res = await app.request(`/images/${imageId}`, {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(403)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("この画像へのアクセス権限がありません")
    })
  })

  describe("認証エラー", () => {
    it("本番環境で認証なしの場合は401を返す（POST /images/upload-url）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = imageRoutes({ env: prodEnv, db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/images", routes)

      const res = await prodApp.request("/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "test.png",
          mimeType: "image/png",
        }),
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })

    it("本番環境で認証なしの場合は401を返す（GET /images/:imageId）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = imageRoutes({ env: prodEnv, db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/images", routes)

      const res = await prodApp.request("/images/some-image-id", {
        headers: { "Content-Type": "application/json" },
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })

    it("本番環境で認証なしの場合は401を返す（POST /images/:imageId/upload）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = imageRoutes({ env: prodEnv, db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/images", routes)

      const pngBuffer = new ArrayBuffer(100)
      const view = new Uint8Array(pngBuffer)
      view[0] = 0x89
      view[1] = 0x50
      view[2] = 0x4e
      view[3] = 0x47

      const res = await prodApp.request("/images/some-image-id/upload", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: pngBuffer,
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })

    it("本番環境で認証なしの場合は401を返す（POST /images/:imageId/ocr）", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const routes = imageRoutes({ env: prodEnv, db: ctx.db as any })

      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.use("*", async (c, next) => {
        if (!c.env) {
          (c as any).env = {}
        }
        Object.assign(c.env, prodEnv)
        await next()
      })
      prodApp.route("/images", routes)

      const res = await prodApp.request("/images/some-image-id/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      expect(res.status).toBe(401)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("認証が必要です")
    })
  })
})
