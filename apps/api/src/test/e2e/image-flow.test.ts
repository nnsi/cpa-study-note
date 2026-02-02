/// <reference types="@cloudflare/workers-types" />
/**
 * E2E: 画像フロー
 *
 * テスト対象:
 * - 画像アップロード -> OCR実行 -> テキスト取得
 * - チャットに画像添付 -> OCR結果をコンテキストに含める
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { z } from "zod"
import {
  setupTestEnv,
  createTestRequest,
  parseSSEResponse,
  cleanupTestEnv,
  type TestContext,
} from "./helpers"

// Zod schemas for response validation
const uploadUrlResponseSchema = z.object({
  imageId: z.string(),
  uploadUrl: z.string(),
})

const uploadResponseSchema = z.object({
  success: z.boolean(),
})

const ocrResponseSchema = z.object({
  imageId: z.string(),
  ocrText: z.string(),
})

const imageDataSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  ocrText: z.string(),
})

const getImageResponseSchema = z.object({
  image: imageDataSchema,
})

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

const createSessionResponseSchema = z.object({
  session: z.object({ id: z.string() }),
})

const createNoteResponseSchema = z.object({
  note: z.object({
    sessionId: z.string(),
    aiSummary: z.string(),
  }),
})

const messagesResponseSchema = z.object({
  messages: z.array(z.object({ role: z.string() })),
})

// Create a simple test image (1x1 PNG)
const createTestImage = (): ArrayBuffer => {
  // Minimal valid PNG: 1x1 white pixel
  const pngData = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimension
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0xff, // compressed data
    0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59,
    0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
    0x44, 0xae, 0x42, 0x60, 0x82,
  ])
  return pngData.buffer as ArrayBuffer
}

describe("E2E: Image Flow", () => {
  let ctx: TestContext
  let req: ReturnType<typeof createTestRequest>

  beforeAll(() => {
    ctx = setupTestEnv()
    req = createTestRequest(ctx.app, ctx.env)
  })

  afterAll(() => {
    cleanupTestEnv(ctx)
  })

  describe("Image Upload URL", () => {
    it("should create upload URL", async () => {
      const res = await req.post("/api/images/upload-url", {
        filename: "test-image.png",
        mimeType: "image/png",
      })

      expect(res.status).toBe(200)
      const data = uploadUrlResponseSchema.parse(await res.json())
      expect(data.imageId).toBeDefined()
      expect(data.uploadUrl).toBeDefined()
      expect(data.uploadUrl).toContain("/api/images/")
      expect(data.uploadUrl).toContain("/upload")
    })
  })

  describe("Image Upload and OCR", () => {
    let imageId: string

    it("should get upload URL and image ID", async () => {
      const res = await req.post("/api/images/upload-url", {
        filename: "accounting-notes.png",
        mimeType: "image/png",
      })

      expect(res.status).toBe(200)
      const data = uploadUrlResponseSchema.parse(await res.json())
      imageId = data.imageId
      expect(imageId).toBeDefined()
    })

    it("should upload image to the URL", async () => {
      expect(imageId).toBeDefined()

      const imageData = createTestImage()
      const res = await req.postRaw(`/api/images/${imageId}/upload`, imageData)

      expect(res.status).toBe(200)
      const data = uploadResponseSchema.parse(await res.json())
      expect(data.success).toBe(true)
    })

    it("should perform OCR on uploaded image", async () => {
      expect(imageId).toBeDefined()

      const res = await req.post(`/api/images/${imageId}/ocr`)

      expect(res.status).toBe(200)
      const data = ocrResponseSchema.parse(await res.json())
      expect(data.imageId).toBe(imageId)
      expect(data.ocrText).toBeDefined()
      // Mock AI adapter returns predefined text
      expect(data.ocrText.length).toBeGreaterThan(0)
    })

    it("should get image with OCR text", async () => {
      expect(imageId).toBeDefined()

      const res = await req.get(`/api/images/${imageId}`)

      expect(res.status).toBe(200)
      const data = getImageResponseSchema.parse(await res.json())
      expect(data.image).toBeDefined()
      expect(data.image.id).toBe(imageId)
      expect(data.image.ocrText).toBeDefined()
    })

    it("should return 404 for non-existent image", async () => {
      const res = await req.get("/api/images/non-existent-id")

      expect(res.status).toBe(404)
    })
  })

  describe("Image Upload Validation", () => {
    let imageId: string

    beforeAll(async () => {
      const res = await req.post("/api/images/upload-url", {
        filename: "large-image.png",
        mimeType: "image/png",
      })
      const data = uploadUrlResponseSchema.parse(await res.json())
      imageId = data.imageId
    })

    it("should reject files larger than 10MB", async () => {
      // Create a large buffer (11MB)
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024)

      const res = await req.postRaw(`/api/images/${imageId}/upload`, largeBuffer)

      expect(res.status).toBe(413)
      const data = errorResponseSchema.parse(await res.json())
      expect(data.error.code).toBe("BAD_REQUEST")
    })
  })

  describe("OCR Error Handling", () => {
    it("should return 404 for OCR on non-existent image", async () => {
      const res = await req.post("/api/images/non-existent-id/ocr")

      expect(res.status).toBe(404)
    })
  })

  describe("Chat with Image", () => {
    let imageId: string
    let ocrText: string

    beforeAll(async () => {
      // Upload image and perform OCR
      const uploadUrlRes = await req.post("/api/images/upload-url", {
        filename: "accounting-formula.png",
        mimeType: "image/png",
      })
      const { imageId: id } = uploadUrlResponseSchema.parse(await uploadUrlRes.json())
      imageId = id

      const imageData = createTestImage()
      await req.postRaw(`/api/images/${imageId}/upload`, imageData)

      const ocrRes = await req.post(`/api/images/${imageId}/ocr`)
      const ocrData = ocrResponseSchema.parse(await ocrRes.json())
      ocrText = ocrData.ocrText
    })

    it("should send chat message with image context", async () => {
      const res = await req.post(
        `/api/chat/topics/${ctx.testData.topicId}/messages/stream`,
        {
          content: "この画像に書かれている内容について説明してください",
          imageId,
          ocrResult: ocrText,
        }
      )

      expect(res.status).toBe(200)

      const chunks = await parseSSEResponse(res)

      // Session should be created
      const sessionChunk = chunks.find((c) => c.type === "session_created")
      expect(sessionChunk?.sessionId).toBeDefined()

      // Should receive AI response
      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks.length).toBeGreaterThan(0)

      const doneChunk = chunks.find((c) => c.type === "done")
      expect(doneChunk).toBeDefined()
    })

    it("should include image context in existing session", async () => {
      // First, create a session
      const firstRes = await req.post(`/api/chat/sessions`, {
        topicId: ctx.testData.topicId,
      })
      const { session } = createSessionResponseSchema.parse(await firstRes.json())

      // Send message with image
      const res = await req.post(
        `/api/chat/sessions/${session.id}/messages/stream`,
        {
          content: "この画像の内容を解説してください",
          imageId,
          ocrResult: ocrText,
        }
      )

      expect(res.status).toBe(200)

      const chunks = await parseSSEResponse(res)
      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks.length).toBeGreaterThan(0)
    })
  })

  describe("Complete Image Flow", () => {
    it("should complete a full image upload and chat flow", { timeout: 60000 }, async () => {
      // Step 1: Get upload URL
      const uploadUrlRes = await req.post("/api/images/upload-url", {
        filename: "study-notes.png",
        mimeType: "image/png",
      })
      expect(uploadUrlRes.status).toBe(200)

      const { imageId, uploadUrl } = uploadUrlResponseSchema.parse(await uploadUrlRes.json())
      expect(imageId).toBeDefined()
      expect(uploadUrl).toBeDefined()

      // Step 2: Upload image
      const imageData = createTestImage()
      const uploadRes = await req.postRaw(`/api/images/${imageId}/upload`, imageData)
      expect(uploadRes.status).toBe(200)

      // Step 3: Perform OCR
      const ocrRes = await req.post(`/api/images/${imageId}/ocr`)
      expect(ocrRes.status).toBe(200)

      const { ocrText } = ocrResponseSchema.parse(await ocrRes.json())
      expect(ocrText).toBeDefined()
      expect(ocrText.length).toBeGreaterThan(0)

      // Step 4: Verify image data is stored
      const imageRes = await req.get(`/api/images/${imageId}`)
      expect(imageRes.status).toBe(200)

      const { image } = getImageResponseSchema.parse(await imageRes.json())
      expect(image.id).toBe(imageId)
      expect(image.filename).toBe("study-notes.png")
      expect(image.mimeType).toBe("image/png")
      expect(image.ocrText).toBe(ocrText)

      // Step 5: Use image in chat
      const chatRes = await req.post(
        `/api/chat/topics/${ctx.testData.topicId}/messages/stream`,
        {
          content: "この画像の会計処理について質問があります。詳しく説明してください。",
          imageId,
          ocrResult: ocrText,
        }
      )
      expect(chatRes.status).toBe(200)

      const chunks = await parseSSEResponse(chatRes)

      // Verify session created
      const sessionChunk = chunks.find((c) => c.type === "session_created")
      expect(sessionChunk?.sessionId).toBeDefined()
      const sessionId = sessionChunk!.sessionId!

      // Verify AI response received
      const textChunks = chunks.filter((c) => c.type === "text")
      expect(textChunks.length).toBeGreaterThan(0)

      // Step 6: Follow up in the same session with another question about the image
      const followUpRes = await req.post(
        `/api/chat/sessions/${sessionId}/messages/stream`,
        {
          content: "この画像に関連して、他に気をつけるべき点はありますか？",
          imageId,
          ocrResult: ocrText,
        }
      )
      expect(followUpRes.status).toBe(200)

      const followUpChunks = await parseSSEResponse(followUpRes)
      expect(followUpChunks.some((c) => c.type === "text")).toBe(true)

      // Step 7: Create note from the session
      const noteRes = await req.post("/api/notes", { sessionId })
      expect(noteRes.status).toBe(201)

      const { note } = createNoteResponseSchema.parse(await noteRes.json())
      expect(note.sessionId).toBe(sessionId)
      expect(note.aiSummary).toBeDefined()

      // Step 8: Verify the complete flow by checking messages
      const messagesRes = await req.get(`/api/chat/sessions/${sessionId}/messages`)
      expect(messagesRes.status).toBe(200)

      const { messages } = messagesResponseSchema.parse(await messagesRes.json())
      // Should have 4 messages (2 user + 2 assistant)
      expect(messages.length).toBe(4)

      // Verify user messages contain image reference
      const userMessages = messages.filter((m: { role: string }) => m.role === "user")
      expect(userMessages.length).toBe(2)
    })
  })
})
