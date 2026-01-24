import { describe, it, expect } from "vitest"
import {
  imageSchema,
  uploadImageRequestSchema,
  uploadUrlResponseSchema,
  ocrResultResponseSchema,
  allowedMimeTypes,
} from "@cpa-study/shared/schemas"
import type { Image } from "./repository"

describe("Image Domain Types", () => {
  describe("Image type (from repository)", () => {
    it("should accept valid Image object", () => {
      const image: Image = {
        id: "image-123",
        userId: "user-123",
        filename: "problem-screenshot.png",
        mimeType: "image/png",
        size: 1024000,
        r2Key: "users/user-123/images/image-123.png",
        ocrText: null,
        createdAt: new Date(),
      }

      expect(image.id).toBe("image-123")
      expect(image.filename).toBe("problem-screenshot.png")
      expect(image.mimeType).toBe("image/png")
      expect(image.size).toBe(1024000)
      expect(image.ocrText).toBeNull()
    })

    it("should accept Image with OCR text", () => {
      const image: Image = {
        id: "image-124",
        userId: "user-123",
        filename: "formula.jpg",
        mimeType: "image/jpeg",
        size: 512000,
        r2Key: "users/user-123/images/image-124.jpg",
        ocrText: "Depreciation = (Cost - Salvage Value) / Useful Life",
        createdAt: new Date(),
      }

      expect(image.ocrText).toBe(
        "Depreciation = (Cost - Salvage Value) / Useful Life"
      )
    })

    it("should handle different MIME types", () => {
      const images: Image[] = [
        {
          id: "img-1",
          userId: "user-123",
          filename: "test.jpeg",
          mimeType: "image/jpeg",
          size: 100,
          r2Key: "key1",
          ocrText: null,
          createdAt: new Date(),
        },
        {
          id: "img-2",
          userId: "user-123",
          filename: "test.png",
          mimeType: "image/png",
          size: 200,
          r2Key: "key2",
          ocrText: null,
          createdAt: new Date(),
        },
        {
          id: "img-3",
          userId: "user-123",
          filename: "test.gif",
          mimeType: "image/gif",
          size: 300,
          r2Key: "key3",
          ocrText: null,
          createdAt: new Date(),
        },
        {
          id: "img-4",
          userId: "user-123",
          filename: "test.webp",
          mimeType: "image/webp",
          size: 400,
          r2Key: "key4",
          ocrText: null,
          createdAt: new Date(),
        },
      ]

      expect(images).toHaveLength(4)
      expect(images.map((i) => i.mimeType)).toEqual([
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ])
    })
  })

  describe("imageSchema (Zod)", () => {
    it("should parse valid image data", () => {
      const data = {
        id: "image-123",
        userId: "user-123",
        filename: "screenshot.png",
        mimeType: "image/png",
        size: 1024000,
        r2Key: "users/user-123/images/image-123.png",
        ocrText: null,
        createdAt: "2024-01-15T10:00:00.000Z",
      }

      const result = imageSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.filename).toBe("screenshot.png")
        expect(result.data.size).toBe(1024000)
      }
    })

    it("should parse image with OCR text", () => {
      const data = {
        id: "image-123",
        userId: "user-123",
        filename: "formula.jpg",
        mimeType: "image/jpeg",
        size: 512000,
        r2Key: "users/user-123/images/image-123.jpg",
        ocrText: "Extracted formula text",
        createdAt: "2024-01-15T10:00:00.000Z",
      }

      const result = imageSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ocrText).toBe("Extracted formula text")
      }
    })

    it("should reject invalid datetime format", () => {
      const data = {
        id: "image-123",
        userId: "user-123",
        filename: "test.png",
        mimeType: "image/png",
        size: 1000,
        r2Key: "key",
        ocrText: null,
        createdAt: "not-a-date",
      }

      const result = imageSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it("should reject missing required fields", () => {
      const data = {
        id: "image-123",
        userId: "user-123",
        filename: "test.png",
      }

      const result = imageSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it("should reject non-number size", () => {
      const data = {
        id: "image-123",
        userId: "user-123",
        filename: "test.png",
        mimeType: "image/png",
        size: "1000", // string instead of number
        r2Key: "key",
        ocrText: null,
        createdAt: "2024-01-15T10:00:00.000Z",
      }

      const result = imageSchema.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe("allowedMimeTypes", () => {
    it("should contain all supported MIME types", () => {
      expect(allowedMimeTypes).toContain("image/jpeg")
      expect(allowedMimeTypes).toContain("image/png")
      expect(allowedMimeTypes).toContain("image/gif")
      expect(allowedMimeTypes).toContain("image/webp")
    })

    it("should have exactly 4 allowed types", () => {
      expect(allowedMimeTypes).toHaveLength(4)
    })
  })

  describe("uploadImageRequestSchema (Zod)", () => {
    it("should parse valid JPEG upload request", () => {
      const result = uploadImageRequestSchema.safeParse({
        filename: "screenshot.jpg",
        mimeType: "image/jpeg",
      })
      expect(result.success).toBe(true)
    })

    it("should parse valid PNG upload request", () => {
      const result = uploadImageRequestSchema.safeParse({
        filename: "diagram.png",
        mimeType: "image/png",
      })
      expect(result.success).toBe(true)
    })

    it("should parse valid GIF upload request", () => {
      const result = uploadImageRequestSchema.safeParse({
        filename: "animation.gif",
        mimeType: "image/gif",
      })
      expect(result.success).toBe(true)
    })

    it("should parse valid WebP upload request", () => {
      const result = uploadImageRequestSchema.safeParse({
        filename: "photo.webp",
        mimeType: "image/webp",
      })
      expect(result.success).toBe(true)
    })

    it("should reject unsupported MIME type", () => {
      const result = uploadImageRequestSchema.safeParse({
        filename: "document.pdf",
        mimeType: "application/pdf",
      })
      expect(result.success).toBe(false)
    })

    it("should reject BMP MIME type", () => {
      const result = uploadImageRequestSchema.safeParse({
        filename: "image.bmp",
        mimeType: "image/bmp",
      })
      expect(result.success).toBe(false)
    })

    it("should reject filename exceeding max length", () => {
      const result = uploadImageRequestSchema.safeParse({
        filename: "a".repeat(256),
        mimeType: "image/png",
      })
      expect(result.success).toBe(false)
    })

    it("should reject missing filename", () => {
      const result = uploadImageRequestSchema.safeParse({
        mimeType: "image/png",
      })
      expect(result.success).toBe(false)
    })

    it("should reject missing mimeType", () => {
      const result = uploadImageRequestSchema.safeParse({
        filename: "test.png",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("uploadUrlResponseSchema (Zod)", () => {
    it("should parse valid upload URL response", () => {
      const data = {
        uploadUrl: "https://r2.example.com/upload?token=abc123",
        imageId: "image-123",
      }

      const result = uploadUrlResponseSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.uploadUrl).toContain("https://")
        expect(result.data.imageId).toBe("image-123")
      }
    })

    it("should reject missing uploadUrl", () => {
      const result = uploadUrlResponseSchema.safeParse({
        imageId: "image-123",
      })
      expect(result.success).toBe(false)
    })

    it("should reject missing imageId", () => {
      const result = uploadUrlResponseSchema.safeParse({
        uploadUrl: "https://example.com/upload",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("ocrResultResponseSchema (Zod)", () => {
    it("should parse valid OCR result response", () => {
      const data = {
        imageId: "image-123",
        ocrText: "Extracted text from the image including formulas and numbers",
      }

      const result = ocrResultResponseSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.imageId).toBe("image-123")
        expect(result.data.ocrText).toContain("Extracted text")
      }
    })

    it("should parse empty OCR text", () => {
      const data = {
        imageId: "image-123",
        ocrText: "",
      }

      const result = ocrResultResponseSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it("should reject missing imageId", () => {
      const result = ocrResultResponseSchema.safeParse({
        ocrText: "Some text",
      })
      expect(result.success).toBe(false)
    })

    it("should reject missing ocrText", () => {
      const result = ocrResultResponseSchema.safeParse({
        imageId: "image-123",
      })
      expect(result.success).toBe(false)
    })
  })
})
