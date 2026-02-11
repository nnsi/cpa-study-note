import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useBookmarks, useToggleBookmark, useIsBookmarked } from "./hooks"

vi.mock("./api", () => ({
  getBookmarks: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
  isBookmarked: vi.fn(),
}))

import * as api from "./api"

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const createWrapper = () => {
  const queryClient = createTestQueryClient()
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

const mockBookmarks = {
  bookmarks: [
    {
      id: "bm-1",
      targetType: "topic" as const,
      targetId: "topic-1",
      name: "テスト論点",
      path: "テスト科目 > テストカテゴリ",
      domainId: "domain-1",
      subjectId: "subject-1",
      categoryId: "category-1",
      createdAt: "2024-01-15T10:00:00.000Z",
    },
    {
      id: "bm-2",
      targetType: "subject" as const,
      targetId: "subject-1",
      name: "テスト科目",
      path: "",
      domainId: "domain-1",
      subjectId: null,
      categoryId: null,
      createdAt: "2024-01-16T10:00:00.000Z",
    },
  ],
}

describe("useBookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ブックマーク一覧を取得する", async () => {
    vi.mocked(api.getBookmarks).mockResolvedValue(mockBookmarks)

    const { result } = renderHook(() => useBookmarks(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.bookmarks).toEqual(mockBookmarks.bookmarks)
    expect(result.current.error).toBeNull()
  })

  it("取得失敗時にerrorを返す", async () => {
    vi.mocked(api.getBookmarks).mockRejectedValue(
      new Error("ブックマークの取得に失敗しました")
    )

    const { result } = renderHook(() => useBookmarks(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })

    expect(result.current.bookmarks).toEqual([])
  })

  it("データ未取得時は空配列を返す", () => {
    vi.mocked(api.getBookmarks).mockResolvedValue(mockBookmarks)

    const { result } = renderHook(() => useBookmarks(), {
      wrapper: createWrapper(),
    })

    // ローディング中は空配列
    expect(result.current.bookmarks).toEqual([])
  })
})

describe("useToggleBookmark", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ブックマーク追加を実行する", async () => {
    vi.mocked(api.addBookmark).mockResolvedValue({
      bookmark: mockBookmarks.bookmarks[0],
    })

    const { result } = renderHook(() => useToggleBookmark(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)

    result.current.toggle("topic", "topic-1", false)

    await waitFor(() => {
      expect(api.addBookmark).toHaveBeenCalledWith("topic", "topic-1")
    })

    expect(api.removeBookmark).not.toHaveBeenCalled()
  })

  it("ブックマーク削除を実行する", async () => {
    vi.mocked(api.removeBookmark).mockResolvedValue(undefined)

    const { result } = renderHook(() => useToggleBookmark(), {
      wrapper: createWrapper(),
    })

    result.current.toggle("topic", "topic-1", true)

    await waitFor(() => {
      expect(api.removeBookmark).toHaveBeenCalledWith("topic", "topic-1")
    })

    expect(api.addBookmark).not.toHaveBeenCalled()
  })
})

describe("useIsBookmarked", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ブックマーク済みの場合trueを返す", async () => {
    vi.mocked(api.getBookmarks).mockResolvedValue(mockBookmarks)
    vi.mocked(api.isBookmarked).mockReturnValue(true)

    const { result } = renderHook(
      () => useIsBookmarked("topic", "topic-1"),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isBookmarked).toBe(true)
  })

  it("ブックマーク未登録の場合falseを返す", async () => {
    vi.mocked(api.getBookmarks).mockResolvedValue(mockBookmarks)
    vi.mocked(api.isBookmarked).mockReturnValue(false)

    const { result } = renderHook(
      () => useIsBookmarked("topic", "topic-999"),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isBookmarked).toBe(false)
  })
})
