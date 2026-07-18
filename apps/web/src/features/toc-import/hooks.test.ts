import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { useTocImages } from "./hooks"

// downscaleImage を明示的に制御するためモック化する
vi.mock("./image-resize", () => ({
  downscaleImage: vi.fn(),
}))

// useTocImages はアップロードAPIも呼ぶためモック化する（本テストでは戻り値は使わない）
vi.mock("@/features/image/api", () => ({
  getUploadUrl: vi.fn().mockResolvedValue({ imageId: "image-1" }),
  uploadImage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/features/subject/api", () => ({
  getSubjectTree: vi.fn(),
  updateSubjectTree: vi.fn(),
}))

import { downscaleImage } from "./image-resize"

const createFile = (name: string) =>
  new File(["dummy"], name, { type: "image/png" })

describe("useTocImages", () => {
  let urlCounter = 0

  beforeEach(() => {
    vi.clearAllMocks()
    urlCounter = 0
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => `blob:${urlCounter++}`),
      revokeObjectURL: vi.fn(),
    })
  })

  it("縮小完了前に画像を削除すると、縮小後に生成されたプレビューURLが解放される", async () => {
    // downscaleImage が完了するまで待たせる
    let resolveDownscale: (file: File) => void
    const downscalePromise = new Promise<File>((resolve) => {
      resolveDownscale = resolve
    })
    vi.mocked(downscaleImage).mockReturnValue(downscalePromise)

    const { result } = renderHook(() => useTocImages())

    act(() => {
      result.current.addFiles([createFile("source.png")])
    })

    await waitFor(() => {
      expect(result.current.images).toHaveLength(1)
    })

    const addedUrl = result.current.images[0]!.previewUrl // blob:0
    vi.mocked(URL.revokeObjectURL).mockClear()

    // 縮小が完了する前に画像を削除する
    act(() => {
      result.current.remove(0)
    })

    expect(result.current.images).toHaveLength(0)
    // 削除時点の元プレビューURLは解放される
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(addedUrl)
    vi.mocked(URL.revokeObjectURL).mockClear()

    // 縮小が完了し、別ファイルとして解決される（プレビューURLが新規生成される）
    const resizedFile = createFile("source.jpg")
    await act(async () => {
      resolveDownscale(resizedFile)
      await downscalePromise
      // upload内の後続処理（マイクロタスク）を流し切る
      await Promise.resolve()
      await Promise.resolve()
    })

    // 縮小完了後に生成された新プレビューURL（blob:1）が、削除済みkeyのため
    // updateImageのupdaterに渡らずリークしていたが、修正後は解放される
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1")
    // リストには何も追加されていない（削除済みのため復活しない）
    expect(result.current.images).toHaveLength(0)
  })

  it("縮小完了時に画像がまだ存在する場合は、通常どおり新しいプレビューURLへ更新される", async () => {
    let resolveDownscale: (file: File) => void
    const downscalePromise = new Promise<File>((resolve) => {
      resolveDownscale = resolve
    })
    vi.mocked(downscaleImage).mockReturnValue(downscalePromise)

    const { result } = renderHook(() => useTocImages())

    act(() => {
      result.current.addFiles([createFile("source.png")])
    })

    await waitFor(() => {
      expect(result.current.images).toHaveLength(1)
    })

    const resizedFile = createFile("source.jpg")
    await act(async () => {
      resolveDownscale(resizedFile)
      await downscalePromise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.images).toHaveLength(1)
    expect(result.current.images[0]!.file).toBe(resizedFile)
  })
})
