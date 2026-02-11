import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import {
  useSubjects,
  useSubject,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  useSubjectTree,
} from "./useSubjects"

vi.mock("../api", () => ({
  getSubjects: vi.fn(),
  getSubject: vi.fn(),
  createSubject: vi.fn(),
  updateSubject: vi.fn(),
  deleteSubject: vi.fn(),
  getSubjectTree: vi.fn(),
  updateSubjectTree: vi.fn(),
  importCSV: vi.fn(),
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

const mockSubjects = {
  subjects: [
    {
      id: "sub-1",
      userId: "user-1",
      name: "財務会計論",
      description: null,
      emoji: null,
      color: null,
      studyDomainId: "domain-1",
      displayOrder: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      categoryCount: 3,
      topicCount: 10,
    },
  ],
}

describe("useSubjects", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("科目一覧を取得する", async () => {
    vi.mocked(api.getSubjects).mockResolvedValue(mockSubjects)

    const { result } = renderHook(() => useSubjects("domain-1"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.subjects).toEqual(mockSubjects.subjects)
    expect(api.getSubjects).toHaveBeenCalledWith("domain-1")
  })

  it("domainIdがundefinedの場合はクエリを実行しない", () => {
    const { result } = renderHook(() => useSubjects(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(api.getSubjects).not.toHaveBeenCalled()
  })

  it("データ未取得時は空配列を返す", () => {
    vi.mocked(api.getSubjects).mockResolvedValue(mockSubjects)

    const { result } = renderHook(() => useSubjects("domain-1"), {
      wrapper: createWrapper(),
    })

    expect(result.current.subjects).toEqual([])
  })
})

describe("useSubject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("科目詳細を取得する", async () => {
    const mockSubject = {
      subject: {
        id: "sub-1",
        userId: "user-1",
        name: "財務会計論",
        description: null,
        emoji: null,
        color: null,
        studyDomainId: "domain-1",
        displayOrder: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    }
    vi.mocked(api.getSubject).mockResolvedValue(mockSubject)

    const { result } = renderHook(() => useSubject("sub-1"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.subject).toEqual(mockSubject.subject)
  })

  it("idがundefinedの場合はクエリを実行しない", () => {
    const { result } = renderHook(() => useSubject(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(api.getSubject).not.toHaveBeenCalled()
  })
})

describe("useCreateSubject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("科目を作成する", async () => {
    const mockResponse = {
      subject: {
        id: "sub-new",
        userId: "user-1",
        name: "新科目",
        description: null,
        emoji: null,
        color: null,
        studyDomainId: "domain-1",
        displayOrder: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    }
    vi.mocked(api.createSubject).mockResolvedValue(mockResponse)

    const queryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useCreateSubject(), { wrapper })

    result.current.mutate({
      domainId: "domain-1",
      data: { name: "新科目" },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.createSubject).toHaveBeenCalledWith("domain-1", {
      name: "新科目",
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["subjects", "domain-1"],
    })
  })
})

describe("useDeleteSubject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("科目を削除する", async () => {
    vi.mocked(api.deleteSubject).mockResolvedValue({ success: true })

    const { result } = renderHook(() => useDeleteSubject(), {
      wrapper: createWrapper(),
    })

    result.current.mutate("sub-1")

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(api.deleteSubject).toHaveBeenCalled()
    expect(vi.mocked(api.deleteSubject).mock.calls[0][0]).toBe("sub-1")
  })
})

describe("useSubjectTree", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("科目のツリーを取得する", async () => {
    const mockTree = {
      tree: {
        subjectId: "sub-1",
        subjectName: "財務会計論",
        categories: [],
      },
    }
    vi.mocked(api.getSubjectTree).mockResolvedValue(mockTree)

    const { result } = renderHook(() => useSubjectTree("sub-1"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.tree).toEqual(mockTree.tree)
    expect(api.getSubjectTree).toHaveBeenCalledWith("sub-1")
  })

  it("idがundefinedの場合はクエリを実行しない", () => {
    const { result } = renderHook(() => useSubjectTree(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(api.getSubjectTree).not.toHaveBeenCalled()
  })
})
