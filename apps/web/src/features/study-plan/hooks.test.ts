import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import {
  useStudyPlans,
  useStudyPlanDetail,
  useCreateStudyPlan,
  useUpdateStudyPlan,
  useArchiveStudyPlan,
  useUnarchiveStudyPlan,
  useDuplicateStudyPlan,
  useAddStudyPlanItem,
  useUpdateStudyPlanItem,
  useRemoveStudyPlanItem,
  useReorderStudyPlanItems,
  useAddStudyPlanRevision,
  useUpdateStudyPlanRevision,
} from "./hooks"

vi.mock("./api", () => ({
  getStudyPlans: vi.fn(),
  getStudyPlanDetail: vi.fn(),
  createStudyPlan: vi.fn(),
  updateStudyPlan: vi.fn(),
  archiveStudyPlan: vi.fn(),
  unarchiveStudyPlan: vi.fn(),
  duplicateStudyPlan: vi.fn(),
  addStudyPlanItem: vi.fn(),
  updateStudyPlanItem: vi.fn(),
  removeStudyPlanItem: vi.fn(),
  reorderStudyPlanItems: vi.fn(),
  addStudyPlanRevision: vi.fn(),
  updateStudyPlanRevision: vi.fn(),
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

const mockPlan = {
  id: "plan-1",
  userId: "user-1",
  title: "テスト計画",
  intent: "テスト説明",
  scope: "all" as const,
  subjectId: null,
  subjectName: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  archivedAt: null,
}

describe("useStudyPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習計画一覧を取得する", async () => {
    const mockData = {
      plans: [{ ...mockPlan, itemCount: 5 }],
    }
    vi.mocked(api.getStudyPlans).mockResolvedValue(mockData)

    const { result } = renderHook(() => useStudyPlans(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.plans).toEqual(mockData.plans)
    expect(api.getStudyPlans).toHaveBeenCalledWith(undefined)
  })

  it("フィルタ付きで取得する", async () => {
    vi.mocked(api.getStudyPlans).mockResolvedValue({ plans: [] })

    renderHook(() => useStudyPlans({ archived: true }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(api.getStudyPlans).toHaveBeenCalledWith({ archived: true })
    })
  })

  it("データ未取得時は空配列を返す", () => {
    vi.mocked(api.getStudyPlans).mockResolvedValue({ plans: [] })

    const { result } = renderHook(() => useStudyPlans(), {
      wrapper: createWrapper(),
    })

    expect(result.current.plans).toEqual([])
  })
})

describe("useStudyPlanDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習計画の詳細を取得する", async () => {
    const mockDetail = {
      plan: mockPlan,
      items: [],
      revisions: [],
    }
    vi.mocked(api.getStudyPlanDetail).mockResolvedValue(mockDetail)

    const { result } = renderHook(() => useStudyPlanDetail("plan-1"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockDetail)
    expect(api.getStudyPlanDetail).toHaveBeenCalledWith("plan-1")
  })
})

describe("useCreateStudyPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習計画を作成する", async () => {
    vi.mocked(api.createStudyPlan).mockResolvedValue({ plan: mockPlan })

    const queryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useCreateStudyPlan(), { wrapper })

    const input = { title: "テスト計画", scope: "all" as const }
    result.current.mutate(input)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.createStudyPlan).toHaveBeenCalledWith(input)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["study-plans"],
    })
  })
})

describe("useArchiveStudyPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習計画をアーカイブする", async () => {
    vi.mocked(api.archiveStudyPlan).mockResolvedValue(undefined)

    const { result } = renderHook(() => useArchiveStudyPlan(), {
      wrapper: createWrapper(),
    })

    result.current.mutate("plan-1")

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.archiveStudyPlan).toHaveBeenCalledWith("plan-1")
  })
})

describe("useUnarchiveStudyPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習計画のアーカイブを解除する", async () => {
    vi.mocked(api.unarchiveStudyPlan).mockResolvedValue(undefined)

    const { result } = renderHook(() => useUnarchiveStudyPlan(), {
      wrapper: createWrapper(),
    })

    result.current.mutate("plan-1")

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.unarchiveStudyPlan).toHaveBeenCalledWith("plan-1")
  })
})

describe("useDuplicateStudyPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習計画を複製する", async () => {
    vi.mocked(api.duplicateStudyPlan).mockResolvedValue({
      plan: { ...mockPlan, id: "plan-2", title: "テスト計画 (コピー)" },
    })

    const { result } = renderHook(() => useDuplicateStudyPlan(), {
      wrapper: createWrapper(),
    })

    result.current.mutate("plan-1")

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.duplicateStudyPlan).toHaveBeenCalledWith("plan-1")
  })
})

describe("useAddStudyPlanItem", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習項目を追加する", async () => {
    const mockItem = {
      item: {
        id: "item-1",
        studyPlanId: "plan-1",
        topicId: "topic-1",
        topicName: "テスト論点",
        description: "テスト説明",
        rationale: null,
        orderIndex: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    }
    vi.mocked(api.addStudyPlanItem).mockResolvedValue(mockItem)

    const queryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useAddStudyPlanItem("plan-1"), {
      wrapper,
    })

    result.current.mutate({ topicId: "topic-1", description: "テスト説明", orderIndex: 0 })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.addStudyPlanItem).toHaveBeenCalledWith("plan-1", {
      topicId: "topic-1",
      description: "テスト説明",
      orderIndex: 0,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["study-plans", "plan-1"],
    })
  })
})

describe("useRemoveStudyPlanItem", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習項目を削除する", async () => {
    vi.mocked(api.removeStudyPlanItem).mockResolvedValue(undefined)

    const { result } = renderHook(() => useRemoveStudyPlanItem("plan-1"), {
      wrapper: createWrapper(),
    })

    result.current.mutate("item-1")

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.removeStudyPlanItem).toHaveBeenCalledWith("plan-1", "item-1")
  })
})

describe("useReorderStudyPlanItems", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("学習項目を並び替える", async () => {
    vi.mocked(api.reorderStudyPlanItems).mockResolvedValue(undefined)

    const { result } = renderHook(
      () => useReorderStudyPlanItems("plan-1"),
      { wrapper: createWrapper() }
    )

    result.current.mutate(["item-2", "item-1", "item-3"])

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.reorderStudyPlanItems).toHaveBeenCalledWith("plan-1", [
      "item-2",
      "item-1",
      "item-3",
    ])
  })
})
