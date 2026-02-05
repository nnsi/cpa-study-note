import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useImageUpload } from "./hooks"
import { allowedMimeTypes } from "@cpa-study/shared/schemas"

// APIモジュールをモック
vi.mock("./api", () => ({
  getUploadUrl: vi.fn(),
  uploadImage: vi.fn(),
  performOCR: vi.fn(),
}))

// URL.createObjectURLとURL.revokeObjectURLをモック
const mockCreateObjectURL = vi.fn(() => "blob:test-url")
const mockRevokeObjectURL = vi.fn()
vi.stubGlobal("URL", {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
})

import * as api from "./api"

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

const createWrapper = () => {
  const queryClient = createTestQueryClient()
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

const createMockFile = (
  name: string,
  type: string,
  _size: number = 1024
): File => {
  const blob = new Blob(["test"], { type })
  return new File([blob], name, { type })
}

describe("useImageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("状態遷移（idle→uploading→processing→done）", async () => {
    // APIモック設定
    vi.mocked(api.getUploadUrl).mockResolvedValue({
      uploadUrl: "https://example.com/upload",
      imageId: "img-123",
    })
    vi.mocked(api.uploadImage).mockResolvedValue(undefined)
    vi.mocked(api.performOCR).mockResolvedValue({
      imageId: "img-123",
      ocrText: "Extracted text from image",
    })

    const { result } = renderHook(() => useImageUpload(), {
      wrapper: createWrapper(),
    })

    // 初期状態
    expect(result.current.status).toBe("idle")
    expect(result.current.imageId).toBeNull()
    expect(result.current.ocrText).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.previewUrl).toBeNull()
    expect(result.current.isUploading).toBe(false)

    // ファイルアップロード開始
    const file = createMockFile("test.jpg", "image/jpeg")

    await act(async () => {
      result.current.upload(file)
    })

    // 完了状態を確認
    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    expect(result.current.imageId).toBe("img-123")
    expect(result.current.ocrText).toBe("Extracted text from image")
    expect(result.current.error).toBeNull()
    expect(result.current.isUploading).toBe(false)

    // APIが正しく呼ばれたか確認
    expect(api.getUploadUrl).toHaveBeenCalledWith("test.jpg", "image/jpeg")
    expect(api.uploadImage).toHaveBeenCalledWith("img-123", file)
    expect(api.performOCR).toHaveBeenCalledWith("img-123")
  })

  it("エラー時の状態遷移", async () => {
    vi.mocked(api.getUploadUrl).mockResolvedValue({
      uploadUrl: "https://example.com/upload",
      imageId: "img-123",
    })
    vi.mocked(api.uploadImage).mockRejectedValue(
      new Error("Upload failed: Network error")
    )

    const { result } = renderHook(() => useImageUpload(), {
      wrapper: createWrapper(),
    })

    const file = createMockFile("test.jpg", "image/jpeg")

    await act(async () => {
      result.current.upload(file)
    })

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })

    expect(result.current.error).toBe("Upload failed: Network error")
    expect(result.current.imageId).toBeNull()
    expect(result.current.isUploading).toBe(false)
  })

  it("reset関数でステートがクリアされる", async () => {
    vi.mocked(api.getUploadUrl).mockResolvedValue({
      uploadUrl: "https://example.com/upload",
      imageId: "img-123",
    })
    vi.mocked(api.uploadImage).mockResolvedValue(undefined)
    vi.mocked(api.performOCR).mockResolvedValue({
      imageId: "img-123",
      ocrText: "Test OCR",
    })

    const { result } = renderHook(() => useImageUpload(), {
      wrapper: createWrapper(),
    })

    // アップロード完了まで待つ
    const file = createMockFile("test.jpg", "image/jpeg")
    await act(async () => {
      result.current.upload(file)
    })

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    // リセット
    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe("idle")
    expect(result.current.imageId).toBeNull()
    expect(result.current.ocrText).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.previewUrl).toBeNull()
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })

  it("OCRエラー時の状態遷移", async () => {
    vi.mocked(api.getUploadUrl).mockResolvedValue({
      uploadUrl: "https://example.com/upload",
      imageId: "img-123",
    })
    vi.mocked(api.uploadImage).mockResolvedValue(undefined)
    vi.mocked(api.performOCR).mockRejectedValue(new Error("OCR service failed"))

    const { result } = renderHook(() => useImageUpload(), {
      wrapper: createWrapper(),
    })

    const file = createMockFile("test.jpg", "image/jpeg")

    await act(async () => {
      result.current.upload(file)
    })

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })

    expect(result.current.error).toBe("OCR service failed")
  })
})

describe("MIME型チェック", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("許可形式", () => {
    it.each(allowedMimeTypes)("%s は許可される", async (mimeType) => {
      vi.mocked(api.getUploadUrl).mockResolvedValue({
        uploadUrl: "https://example.com/upload",
        imageId: "img-123",
      })
      vi.mocked(api.uploadImage).mockResolvedValue(undefined)
      vi.mocked(api.performOCR).mockResolvedValue({
        imageId: "img-123",
        ocrText: "Test",
      })

      const { result } = renderHook(() => useImageUpload(), {
        wrapper: createWrapper(),
      })

      const file = createMockFile("test.file", mimeType)

      await act(async () => {
        result.current.upload(file)
      })

      await waitFor(() => {
        expect(result.current.status).toBe("done")
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe("非許可形式拒否", () => {
    it.each([
      "application/pdf",
      "text/plain",
      "video/mp4",
      "image/svg+xml",
      "image/bmp",
      "application/octet-stream",
    ])("%s は拒否される", async (mimeType) => {
      const { result } = renderHook(() => useImageUpload(), {
        wrapper: createWrapper(),
      })

      const file = createMockFile("test.file", mimeType)

      await act(async () => {
        result.current.upload(file)
      })

      await waitFor(() => {
        expect(result.current.status).toBe("error")
      })

      expect(result.current.error).toBe(`Unsupported file type: ${mimeType}`)
      // APIが呼ばれていないことを確認
      expect(api.getUploadUrl).not.toHaveBeenCalled()
    })
  })
})
