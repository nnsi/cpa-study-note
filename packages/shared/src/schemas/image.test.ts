import { describe, it, expect } from "vitest"
import {
  imageSchema,
  allowedMimeTypes,
  uploadImageRequestSchema,
  uploadUrlResponseSchema,
  ocrResultResponseSchema,
} from "./image"

describe("imageSchema", () => {
  const validImage = {
    id: "img-1",
    userId: "user-1",
    filename: "test.jpg",
    mimeType: "image/jpeg",
    size: 1024,
    r2Key: "uploads/img-1.jpg",
    ocrText: null,
    createdAt: "2025-01-01T00:00:00Z",
  }

  it("有効なデータをパースできる", () => {
    const result = imageSchema.safeParse(validImage)
    expect(result.success).toBe(true)
  })

  it("ocrTextがnullでも有効", () => {
    const result = imageSchema.safeParse(validImage)
    expect(result.success).toBe(true)
  })

  it("ocrTextが文字列でも有効", () => {
    const result = imageSchema.safeParse({ ...validImage, ocrText: "OCRテキスト" })
    expect(result.success).toBe(true)
  })

  it("必須フィールド欠落でエラー", () => {
    const result = imageSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("sizeが数値でない場合エラー", () => {
    const result = imageSchema.safeParse({ ...validImage, size: "big" })
    expect(result.success).toBe(false)
  })
})

describe("allowedMimeTypes", () => {
  it("4種類のMIMEタイプが定義されている", () => {
    expect(allowedMimeTypes).toHaveLength(4)
    expect(allowedMimeTypes).toContain("image/jpeg")
    expect(allowedMimeTypes).toContain("image/png")
    expect(allowedMimeTypes).toContain("image/gif")
    expect(allowedMimeTypes).toContain("image/webp")
  })
})

describe("uploadImageRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = uploadImageRequestSchema.safeParse({
      filename: "photo.png",
      mimeType: "image/png",
    })
    expect(result.success).toBe(true)
  })

  it("filenameが255文字超でエラー", () => {
    const result = uploadImageRequestSchema.safeParse({
      filename: "a".repeat(256),
      mimeType: "image/jpeg",
    })
    expect(result.success).toBe(false)
  })

  it("不正なmimeTypeでエラー", () => {
    const result = uploadImageRequestSchema.safeParse({
      filename: "doc.pdf",
      mimeType: "application/pdf",
    })
    expect(result.success).toBe(false)
  })
})

describe("uploadUrlResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = uploadUrlResponseSchema.safeParse({
      uploadUrl: "https://example.com/upload",
      imageId: "img-1",
    })
    expect(result.success).toBe(true)
  })
})

describe("ocrResultResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = ocrResultResponseSchema.safeParse({
      imageId: "img-1",
      ocrText: "認識テキスト",
    })
    expect(result.success).toBe(true)
  })
})

// ===== 境界値テスト =====

describe("uploadImageRequestSchema - 境界値", () => {
  it("filenameがちょうど255文字でOK（max境界）", () => {
    const result = uploadImageRequestSchema.safeParse({
      filename: "a".repeat(255),
      mimeType: "image/jpeg",
    })
    expect(result.success).toBe(true)
  })
})
