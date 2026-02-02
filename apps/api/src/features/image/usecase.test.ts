/**
 * Image UseCase のテスト
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ImageRepository } from "./repository"
import type { AIAdapter } from "@/shared/lib/ai"
import {
  createUploadUrl,
  uploadImage,
  performOCR,
  getImage,
} from "./usecase"
import { createMockR2Bucket } from "@/test/mocks/r2"

// テストデータ生成ヘルパー
const createMockDate = (offset = 0) => new Date(Date.now() + offset)

const createMockImage = (overrides = {}) => ({
  id: "image-1",
  userId: "user-1",
  filename: "test.png",
  mimeType: "image/png",
  size: 1024,
  r2Key: "images/image-1/test.png",
  ocrText: null,
  createdAt: createMockDate(),
  ...overrides,
})

// モックリポジトリファクトリ
const createMockImageRepo = (overrides: Partial<ImageRepository> = {}): ImageRepository => ({
  create: vi.fn().mockResolvedValue(createMockImage()),
  findById: vi.fn().mockResolvedValue(null),
  updateOcrText: vi.fn().mockResolvedValue(undefined),
  ...overrides,
})

const createMockAIAdapter = (overrides: Partial<AIAdapter> = {}): AIAdapter => ({
  generateText: vi.fn().mockResolvedValue({
    content: "抽出されたテキスト: サンプルテキスト",
  }),
  streamText: vi.fn(),
  ...overrides,
})

// PNG マジックバイト
const createPngBuffer = (): ArrayBuffer => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return bytes.buffer as ArrayBuffer
}

// JPEG マジックバイト
const createJpegBuffer = (): ArrayBuffer => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
  return bytes.buffer as ArrayBuffer
}

// 不正なバイト列
const createInvalidBuffer = (): ArrayBuffer => {
  const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00])
  return bytes.buffer as ArrayBuffer
}

describe("Image UseCase", () => {
  describe("createUploadUrl", () => {
    it("署名付きURLを生成する", async () => {
      // crypto.randomUUIDをモック
      const mockUUID = "test-uuid-1234"
      vi.spyOn(crypto, "randomUUID").mockReturnValue(mockUUID)

      const imageRepo = createMockImageRepo()
      const apiBaseUrl = "https://api.example.com"

      const result = await createUploadUrl(
        { imageRepo, apiBaseUrl },
        { userId: "user-1", filename: "test.png", mimeType: "image/png" }
      )

      expect(result.imageId).toBe(mockUUID)
      expect(result.uploadUrl).toBe(`${apiBaseUrl}/api/images/${mockUUID}/upload`)
      expect(imageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUUID,
          userId: "user-1",
          filename: "test.png",
          mimeType: "image/png",
        })
      )

      vi.restoreAllMocks()
    })

    it("ファイル名をサニタイズする", async () => {
      const mockUUID = "test-uuid-5678"
      vi.spyOn(crypto, "randomUUID").mockReturnValue(mockUUID)

      const imageRepo = createMockImageRepo()
      const apiBaseUrl = "https://api.example.com"

      await createUploadUrl(
        { imageRepo, apiBaseUrl },
        { userId: "user-1", filename: "../../../etc/passwd", mimeType: "image/png" }
      )

      // r2Keyにパストラバーサルが含まれないことを確認
      expect(imageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          r2Key: expect.stringContaining("passwd"),
        })
      )
      expect(imageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          r2Key: expect.not.stringContaining(".."),
        })
      )

      vi.restoreAllMocks()
    })
  })

  describe("uploadImage", () => {
    it("正常にアップロードする", async () => {
      const image = createMockImage({ mimeType: "image/png" })
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })
      const r2 = createMockR2Bucket()
      const pngBuffer = createPngBuffer()

      const result = await uploadImage(
        { imageRepo, r2 },
        "user-1",
        "image-1",
        pngBuffer
      )

      expect(result.ok).toBe(true)
      // R2にアップロードされたことを確認
      const uploaded = await r2.get(image.r2Key)
      expect(uploaded).not.toBeNull()
    })

    it("存在しない画像でエラーを返す", async () => {
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(null),
      })
      const r2 = createMockR2Bucket()

      const result = await uploadImage(
        { imageRepo, r2 },
        "user-1",
        "non-existent",
        createPngBuffer()
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND")
      }
    })

    it("他ユーザーの画像アップロードを拒否する", async () => {
      const image = createMockImage({ userId: "other-user" })
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })
      const r2 = createMockR2Bucket()

      const result = await uploadImage(
        { imageRepo, r2 },
        "user-1",
        "image-1",
        createPngBuffer()
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN")
      }
    })

    it("不正なファイル形式を拒否する", async () => {
      const image = createMockImage({ mimeType: "image/png" })
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })
      const r2 = createMockR2Bucket()
      const invalidBuffer = createInvalidBuffer()

      const result = await uploadImage(
        { imageRepo, r2 },
        "user-1",
        "image-1",
        invalidBuffer
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("BAD_REQUEST")
      }
    })

    it("MIMEタイプと実際のファイル形式が一致しない場合を拒否する", async () => {
      // MIMEタイプはPNGだが、実際はJPEG
      const image = createMockImage({ mimeType: "image/png" })
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })
      const r2 = createMockR2Bucket()
      const jpegBuffer = createJpegBuffer()

      const result = await uploadImage(
        { imageRepo, r2 },
        "user-1",
        "image-1",
        jpegBuffer
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("BAD_REQUEST")
      }
    })
  })

  describe("performOCR", () => {
    it("OCRテキストを取得・保存する", async () => {
      const image = createMockImage()
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })
      const aiAdapter = createMockAIAdapter({
        generateText: vi.fn().mockResolvedValue({
          content: "抽出されたテキスト: 有価証券の評価損益",
        }),
      })
      const r2 = createMockR2Bucket()

      // R2に画像をアップロード
      const pngBuffer = createPngBuffer()
      await r2.put(image.r2Key, pngBuffer, {
        httpMetadata: { contentType: "image/png" },
      })

      const result = await performOCR(
        { imageRepo, aiAdapter, r2, apiBaseUrl: "https://api.example.com" },
        "user-1",
        "image-1"
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.imageId).toBe("image-1")
        expect(result.value.ocrText).toBe("抽出されたテキスト: 有価証券の評価損益")
      }
      expect(imageRepo.updateOcrText).toHaveBeenCalledWith(
        "image-1",
        "抽出されたテキスト: 有価証券の評価損益"
      )
    })

    it("存在しない画像でエラーを返す", async () => {
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(null),
      })
      const aiAdapter = createMockAIAdapter()
      const r2 = createMockR2Bucket()

      const result = await performOCR(
        { imageRepo, aiAdapter, r2, apiBaseUrl: "https://api.example.com" },
        "user-1",
        "non-existent"
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND")
      }
    })

    it("他ユーザーの画像OCRを拒否する", async () => {
      const image = createMockImage({ userId: "other-user" })
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })
      const aiAdapter = createMockAIAdapter()
      const r2 = createMockR2Bucket()

      const result = await performOCR(
        { imageRepo, aiAdapter, r2, apiBaseUrl: "https://api.example.com" },
        "user-1",
        "image-1"
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN")
      }
    })

    it("R2に画像ファイルが存在しない場合エラーを返す", async () => {
      const image = createMockImage()
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })
      const aiAdapter = createMockAIAdapter()
      const r2 = createMockR2Bucket() // 空のR2

      const result = await performOCR(
        { imageRepo, aiAdapter, r2, apiBaseUrl: "https://api.example.com" },
        "user-1",
        "image-1"
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND")
      }
    })
  })

  describe("getImage", () => {
    it("メタデータを取得する", async () => {
      const image = createMockImage()
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })

      const result = await getImage({ imageRepo }, "user-1", "image-1")

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.id).toBe("image-1")
        expect(result.value.filename).toBe("test.png")
        expect(result.value.mimeType).toBe("image/png")
        expect(result.value.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      }
    })

    it("存在しない画像でエラーを返す", async () => {
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(null),
      })

      const result = await getImage({ imageRepo }, "user-1", "non-existent")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND")
      }
    })

    it("他ユーザーの画像アクセスを拒否する", async () => {
      const image = createMockImage({ userId: "other-user" })
      const imageRepo = createMockImageRepo({
        findById: vi.fn().mockResolvedValue(image),
      })

      const result = await getImage({ imageRepo }, "user-1", "image-1")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN")
      }
    })
  })
})
