import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useCheckHistory } from "./hooks"

vi.mock("./api", () => ({
  getCheckHistory: vi.fn(),
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

describe("useCheckHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("チェック履歴を取得する", async () => {
    const mockHistory = {
      history: [
        {
          id: "check-1",
          action: "checked" as const,
          checkedAt: "2024-01-15T10:00:00.000Z",
        },
        {
          id: "check-2",
          action: "unchecked" as const,
          checkedAt: "2024-01-10T10:00:00.000Z",
        },
      ],
    }
    vi.mocked(api.getCheckHistory).mockResolvedValue(mockHistory)

    const { result } = renderHook(
      () => useCheckHistory("subject-1", "topic-1"),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockHistory)
    expect(api.getCheckHistory).toHaveBeenCalledWith("subject-1", "topic-1")
  })

  it("エラー時にerrorを返す", async () => {
    vi.mocked(api.getCheckHistory).mockRejectedValue(
      new Error("チェック履歴の取得に失敗しました")
    )

    const { result } = renderHook(
      () => useCheckHistory("subject-1", "topic-1"),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })
})
