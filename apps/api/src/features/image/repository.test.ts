import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData } from "../../test/mocks/db"
import { createImageRepository, type ImageRepository } from "./repository"

describe("ImageRepository", () => {
  let repository: ImageRepository
  let testData: ReturnType<typeof seedTestData>

  beforeEach(() => {
    const { db } = createTestDatabase()
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createImageRepository(db as any)
  })

  describe("create", () => {
    it("should create image metadata", async () => {
      const imageData = {
        id: "image-123",
        userId: testData.userId,
        filename: "test-image.png",
        mimeType: "image/png",
        size: 1024,
        r2Key: "images/test-user-1/image-123.png",
        ocrText: null,
      }

      const image = await repository.create(imageData)

      expect(image.id).toBe("image-123")
      expect(image.userId).toBe(testData.userId)
      expect(image.filename).toBe("test-image.png")
      expect(image.mimeType).toBe("image/png")
      expect(image.size).toBe(1024)
      expect(image.r2Key).toBe("images/test-user-1/image-123.png")
      expect(image.ocrText).toBeNull()
      expect(image.createdAt).toBeInstanceOf(Date)
    })

    it("should create image with OCR text", async () => {
      const imageData = {
        id: "image-456",
        userId: testData.userId,
        filename: "document.jpg",
        mimeType: "image/jpeg",
        size: 2048,
        r2Key: "images/test-user-1/image-456.jpg",
        ocrText: "Extracted text from document",
      }

      const image = await repository.create(imageData)

      expect(image.ocrText).toBe("Extracted text from document")
    })

    it("should handle different mime types", async () => {
      const jpegImage = await repository.create({
        id: "jpeg-image",
        userId: testData.userId,
        filename: "photo.jpeg",
        mimeType: "image/jpeg",
        size: 5000,
        r2Key: "images/test-user-1/jpeg-image.jpeg",
        ocrText: null,
      })

      const webpImage = await repository.create({
        id: "webp-image",
        userId: testData.userId,
        filename: "modern.webp",
        mimeType: "image/webp",
        size: 3000,
        r2Key: "images/test-user-1/webp-image.webp",
        ocrText: null,
      })

      expect(jpegImage.mimeType).toBe("image/jpeg")
      expect(webpImage.mimeType).toBe("image/webp")
    })
  })

  describe("findById", () => {
    it("should return image when exists", async () => {
      await repository.create({
        id: "find-me-image",
        userId: testData.userId,
        filename: "findable.png",
        mimeType: "image/png",
        size: 1500,
        r2Key: "images/test-user-1/find-me-image.png",
        ocrText: null,
      })

      const found = await repository.findById("find-me-image")

      expect(found).not.toBeNull()
      expect(found?.id).toBe("find-me-image")
      expect(found?.filename).toBe("findable.png")
      expect(found?.size).toBe(1500)
    })

    it("should return null when image does not exist", async () => {
      const found = await repository.findById("non-existent-image")

      expect(found).toBeNull()
    })

    it("should return image with OCR text", async () => {
      await repository.create({
        id: "ocr-image",
        userId: testData.userId,
        filename: "with-ocr.png",
        mimeType: "image/png",
        size: 2000,
        r2Key: "images/test-user-1/ocr-image.png",
        ocrText: "Some OCR text",
      })

      const found = await repository.findById("ocr-image")

      expect(found?.ocrText).toBe("Some OCR text")
    })
  })

  describe("updateOcrText", () => {
    it("should update OCR text for existing image", async () => {
      await repository.create({
        id: "update-ocr-image",
        userId: testData.userId,
        filename: "update-ocr.png",
        mimeType: "image/png",
        size: 1000,
        r2Key: "images/test-user-1/update-ocr-image.png",
        ocrText: null,
      })

      await repository.updateOcrText(
        "update-ocr-image",
        "Newly extracted OCR text"
      )

      const updated = await repository.findById("update-ocr-image")
      expect(updated?.ocrText).toBe("Newly extracted OCR text")
    })

    it("should replace existing OCR text", async () => {
      await repository.create({
        id: "replace-ocr-image",
        userId: testData.userId,
        filename: "replace-ocr.png",
        mimeType: "image/png",
        size: 1000,
        r2Key: "images/test-user-1/replace-ocr-image.png",
        ocrText: "Original OCR text",
      })

      await repository.updateOcrText(
        "replace-ocr-image",
        "Updated OCR text"
      )

      const updated = await repository.findById("replace-ocr-image")
      expect(updated?.ocrText).toBe("Updated OCR text")
    })

    it("should handle long OCR text", async () => {
      await repository.create({
        id: "long-ocr-image",
        userId: testData.userId,
        filename: "long-ocr.png",
        mimeType: "image/png",
        size: 5000,
        r2Key: "images/test-user-1/long-ocr-image.png",
        ocrText: null,
      })

      const longText = "A".repeat(10000) // 10,000文字のテキスト

      await repository.updateOcrText("long-ocr-image", longText)

      const updated = await repository.findById("long-ocr-image")
      expect(updated?.ocrText).toBe(longText)
      expect(updated?.ocrText?.length).toBe(10000)
    })

    it("should handle Japanese OCR text", async () => {
      await repository.create({
        id: "japanese-ocr-image",
        userId: testData.userId,
        filename: "japanese.png",
        mimeType: "image/png",
        size: 2000,
        r2Key: "images/test-user-1/japanese-ocr-image.png",
        ocrText: null,
      })

      const japaneseText = "仕訳: 借方 有価証券 1,000 / 貸方 現金 1,000"

      await repository.updateOcrText("japanese-ocr-image", japaneseText)

      const updated = await repository.findById("japanese-ocr-image")
      expect(updated?.ocrText).toBe(japaneseText)
    })

    it("should not throw error when updating non-existent image", async () => {
      // This operation should not throw, even if the image doesn't exist
      await expect(
        repository.updateOcrText("non-existent-image", "Some text")
      ).resolves.not.toThrow()
    })
  })
})
