import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import {
  useStudyDomains,
  useCreateStudyDomain,
  useUpdateStudyDomain,
  useDeleteStudyDomain,
} from "./useStudyDomains"

vi.mock("../api", () => ({
  getStudyDomains: vi.fn(),
  createStudyDomain: vi.fn(),
  updateStudyDomain: vi.fn(),
  deleteStudyDomain: vi.fn(),
}))

import * as api from "../api"

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

const mockDomains = {
  studyDomains: [
    {
      id: "domain-1",
      userId: "user-1",
      name: "公認会計士試験",
      description: "CPA試験の学習領域",
      emoji: null,
      color: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "domain-2",
      userId: "user-1",
      name: "税理士試験",
      description: "税理士試験の学習領域",
      emoji: null,
      color: null,
      createdAt: "2024-01-02T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    },
  ],
}

describe("useStudyDomains", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習領域一覧を取得する", async () => {
    vi.mocked(api.getStudyDomains).mockResolvedValue(mockDomains)

    const { result } = renderHook(() => useStudyDomains(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.studyDomains).toEqual(mockDomains.studyDomains)
    expect(result.current.error).toBeNull()
  })

  it("データ未取得時は空配列を返す", () => {
    vi.mocked(api.getStudyDomains).mockResolvedValue(mockDomains)

    const { result } = renderHook(() => useStudyDomains(), {
      wrapper: createWrapper(),
    })

    expect(result.current.studyDomains).toEqual([])
  })

  it("エラー時にerrorを返す", async () => {
    vi.mocked(api.getStudyDomains).mockRejectedValue(
      new Error("学習領域の取得に失敗しました")
    )

    const { result } = renderHook(() => useStudyDomains(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })

    expect(result.current.studyDomains).toEqual([])
  })
})

describe("useCreateStudyDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習領域を作成する", async () => {
    const newDomain = {
      studyDomain: mockDomains.studyDomains[0],
    }
    vi.mocked(api.createStudyDomain).mockResolvedValue(newDomain)

    const queryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useCreateStudyDomain(), { wrapper })

    result.current.mutate({ name: "新しい領域", description: "テスト" })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.createStudyDomain).toHaveBeenCalled()
    expect(vi.mocked(api.createStudyDomain).mock.calls[0][0]).toEqual({
      name: "新しい領域",
      description: "テスト",
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["study-domains"],
    })
  })
})

describe("useUpdateStudyDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習領域を更新する", async () => {
    vi.mocked(api.updateStudyDomain).mockResolvedValue({
      studyDomain: { ...mockDomains.studyDomains[0], name: "更新後" },
    })

    const { result } = renderHook(() => useUpdateStudyDomain(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      id: "domain-1",
      data: { name: "更新後" },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.updateStudyDomain).toHaveBeenCalledWith("domain-1", {
      name: "更新後",
    })
  })
})

describe("useDeleteStudyDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習領域を削除する", async () => {
    vi.mocked(api.deleteStudyDomain).mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteStudyDomain(), {
      wrapper: createWrapper(),
    })

    result.current.mutate("domain-1")

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.deleteStudyDomain).toHaveBeenCalled()
    expect(vi.mocked(api.deleteStudyDomain).mock.calls[0][0]).toBe("domain-1")
  })
})
