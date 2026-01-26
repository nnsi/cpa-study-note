import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useNotesByTopic, useCreateNote } from "./hooks"

// APIモジュールをモック
vi.mock("./api", () => ({
  getNotesByTopic: vi.fn(),
  createNote: vi.fn(),
}))

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

// テストデータ
const mockNotes = {
  notes: [
    {
      id: "note-1",
      userId: "user-1",
      topicId: "topic-1",
      sessionId: "session-1",
      aiSummary: "テスト要約",
      userMemo: null,
      keyPoints: ["ポイント1"],
      stumbledPoints: [] as string[],
      createdAt: "2024-01-15T10:30:00.000Z",
      updatedAt: "2024-01-15T10:30:00.000Z",
      source: "chat" as const,
    },
    {
      id: "note-2",
      userId: "user-1",
      topicId: "topic-1",
      sessionId: "session-2",
      aiSummary: "別の要約",
      userMemo: "メモ",
      keyPoints: ["ポイント2", "ポイント3"],
      stumbledPoints: ["つまずき1"],
      createdAt: "2024-01-16T10:30:00.000Z",
      updatedAt: "2024-01-16T10:30:00.000Z",
      source: "chat" as const,
    },
  ],
}

const mockCreatedNote = {
  note: {
    id: "note-new",
    userId: "user-1",
    topicId: "topic-1",
    sessionId: "session-new",
    aiSummary: "新しい要約",
    userMemo: null,
    keyPoints: ["新ポイント"],
    stumbledPoints: [] as string[],
    createdAt: "2024-01-17T10:30:00.000Z",
    updatedAt: "2024-01-17T10:30:00.000Z",
    source: "chat" as const,
  },
}

describe("useNotesByTopic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("論点別ノート一覧を取得する", async () => {
    vi.mocked(api.getNotesByTopic).mockResolvedValue(mockNotes)

    const { result } = renderHook(() => useNotesByTopic("topic-1"), {
      wrapper: createWrapper(),
    })

    // 初期状態（ローディング）
    expect(result.current.isLoading).toBe(true)

    // データ取得完了を待つ
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockNotes)
    expect(result.current.error).toBeNull()
    expect(api.getNotesByTopic).toHaveBeenCalledWith("topic-1")
  })

  it("エラー時にerrorを返す", async () => {
    vi.mocked(api.getNotesByTopic).mockRejectedValue(
      new Error("Failed to fetch notes")
    )

    const { result } = renderHook(() => useNotesByTopic("topic-1"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
    expect(result.current.data).toBeUndefined()
  })

  it("異なるtopicIdで再フェッチする", async () => {
    vi.mocked(api.getNotesByTopic).mockResolvedValue(mockNotes)

    const { result, rerender } = renderHook(
      ({ topicId }) => useNotesByTopic(topicId),
      {
        wrapper: createWrapper(),
        initialProps: { topicId: "topic-1" },
      }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(api.getNotesByTopic).toHaveBeenCalledWith("topic-1")

    // topicIdを変更
    rerender({ topicId: "topic-2" })

    await waitFor(() => {
      expect(api.getNotesByTopic).toHaveBeenCalledWith("topic-2")
    })
  })
})

describe("useCreateNote", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ノートを作成する", async () => {
    vi.mocked(api.createNote).mockResolvedValue(mockCreatedNote)

    const { result } = renderHook(() => useCreateNote("topic-1"), {
      wrapper: createWrapper(),
    })

    // 初期状態
    expect(result.current.isPending).toBe(false)

    // ミューテーション実行
    result.current.mutate("session-new")

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.createNote).toHaveBeenCalledWith("session-new")
    expect(result.current.data).toEqual(mockCreatedNote)
  })

  it("ノート作成エラー時にerrorを返す", async () => {
    vi.mocked(api.createNote).mockRejectedValue(
      new Error("Failed to create note")
    )

    const { result } = renderHook(() => useCreateNote("topic-1"), {
      wrapper: createWrapper(),
    })

    result.current.mutate("session-error")

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
    expect(result.current.data).toBeUndefined()
  })

  it("成功時にキャッシュを無効化する", async () => {
    vi.mocked(api.createNote).mockResolvedValue(mockCreatedNote)
    vi.mocked(api.getNotesByTopic).mockResolvedValue(mockNotes)

    const queryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    // 先にノート一覧を取得
    const { result: notesResult } = renderHook(
      () => useNotesByTopic("topic-1"),
      { wrapper }
    )

    await waitFor(() => {
      expect(notesResult.current.isLoading).toBe(false)
    })

    // invalidateQueriesをスパイ
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    // ノート作成
    const { result: createResult } = renderHook(
      () => useCreateNote("topic-1"),
      { wrapper }
    )

    createResult.current.mutate("session-new")

    await waitFor(() => {
      expect(createResult.current.isSuccess).toBe(true)
    })

    // キャッシュ無効化が呼ばれたことを確認
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["notes", "topic", "topic-1"],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["notes"],
    })
  })
})
