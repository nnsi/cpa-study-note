import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useTodayMetrics, useRecentTopics } from "./hooks"

vi.mock("./api", () => ({
  getTodayMetrics: vi.fn(),
  getRecentTopics: vi.fn(),
}))

import * as api from "./api"

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

const createWrapper = () => {
  const queryClient = createTestQueryClient()
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useTodayMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("今日の学習指標を取得する", async () => {
    const mockMetrics = {
      metrics: {
        checkedTopicCount: 10,
        sessionCount: 3,
        messageCount: 25,
      },
    }
    vi.mocked(api.getTodayMetrics).mockResolvedValue(mockMetrics)

    const { result } = renderHook(() => useTodayMetrics(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.metrics).toEqual(mockMetrics.metrics)
    expect(result.current.error).toBeNull()
  })

  it("データ未取得時はnullを返す", () => {
    vi.mocked(api.getTodayMetrics).mockResolvedValue({
      metrics: { checkedTopicCount: 0, sessionCount: 0, messageCount: 0 },
    })

    const { result } = renderHook(() => useTodayMetrics(), {
      wrapper: createWrapper(),
    })

    // ローディング中はnull
    expect(result.current.metrics).toBeNull()
  })

  it("エラー時にerrorを返す", async () => {
    vi.mocked(api.getTodayMetrics).mockRejectedValue(
      new Error("今日の学習指標の取得に失敗しました")
    )

    const { result } = renderHook(() => useTodayMetrics(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })

    expect(result.current.metrics).toBeNull()
  })
})

describe("useRecentTopics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("最近の論点を取得する", async () => {
    const mockTopics = {
      topics: [
        {
          topicId: "topic-1",
          topicName: "テスト論点",
          domainId: "domain-1",
          subjectId: "subject-1",
          subjectName: "テスト科目",
          categoryId: "category-1",
          lastAccessedAt: "2024-01-15T10:00:00.000Z",
        },
        {
          topicId: "topic-2",
          topicName: "別の論点",
          domainId: "domain-1",
          subjectId: "subject-1",
          subjectName: "別の科目",
          categoryId: "category-2",
          lastAccessedAt: "2024-01-14T10:00:00.000Z",
        },
      ],
    }
    vi.mocked(api.getRecentTopics).mockResolvedValue(mockTopics)

    const { result } = renderHook(() => useRecentTopics(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.topics).toEqual(mockTopics.topics)
    expect(result.current.error).toBeNull()
  })

  it("データ未取得時は空配列を返す", () => {
    vi.mocked(api.getRecentTopics).mockResolvedValue({ topics: [] })

    const { result } = renderHook(() => useRecentTopics(), {
      wrapper: createWrapper(),
    })

    expect(result.current.topics).toEqual([])
  })

  it("エラー時にerrorを返す", async () => {
    vi.mocked(api.getRecentTopics).mockRejectedValue(
      new Error("最近の論点の取得に失敗しました")
    )

    const { result } = renderHook(() => useRecentTopics(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })

    expect(result.current.topics).toEqual([])
  })
})
