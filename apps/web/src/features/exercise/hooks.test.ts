import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useExerciseAnalyze, useExerciseConfirm, useTopicExercises } from "./hooks"

vi.mock("./api", () => ({
  analyzeExercise: vi.fn(),
  confirmExercise: vi.fn(),
  getTopicExercises: vi.fn(),
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

describe("useExerciseAnalyze", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // URL.createObjectURLのモック
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    })
  })

  it("初期状態", () => {
    const { result } = renderHook(() => useExerciseAnalyze(), {
      wrapper: createWrapper(),
    })

    expect(result.current.status).toBe("idle")
    expect(result.current.exerciseId).toBeNull()
    expect(result.current.imageId).toBeNull()
    expect(result.current.ocrText).toBeNull()
    expect(result.current.suggestedTopics).toEqual([])
    expect(result.current.previewUrl).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isAnalyzing).toBe(false)
  })

  it("分析成功時に結果を保持する", async () => {
    const mockResult = {
      exerciseId: "ex-1",
      imageId: "img-1",
      ocrText: "テスト問題文",
      suggestedTopics: [
        { topicId: "topic-1", topicName: "論点A", subjectName: "科目A", confidence: "high" as const, reason: "テスト理由" },
      ],
    }
    vi.mocked(api.analyzeExercise).mockResolvedValue(mockResult)

    const { result } = renderHook(() => useExerciseAnalyze(), {
      wrapper: createWrapper(),
    })

    const mockFile = new File(["test"], "test.png", { type: "image/png" })

    await act(async () => {
      result.current.analyze(mockFile)
    })

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    expect(result.current.exerciseId).toBe("ex-1")
    expect(result.current.imageId).toBe("img-1")
    expect(result.current.ocrText).toBe("テスト問題文")
    expect(result.current.suggestedTopics).toHaveLength(1)
  })

  it("分析失敗時にエラーを保持する", async () => {
    vi.mocked(api.analyzeExercise).mockRejectedValue(
      new Error("分析に失敗しました")
    )

    const { result } = renderHook(() => useExerciseAnalyze(), {
      wrapper: createWrapper(),
    })

    const mockFile = new File(["test"], "test.png", { type: "image/png" })

    await act(async () => {
      result.current.analyze(mockFile)
    })

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })

    expect(result.current.error).toBe("分析に失敗しました")
  })

  it("リセットで初期状態に戻る", async () => {
    const mockResult = {
      exerciseId: "ex-1",
      imageId: "img-1",
      ocrText: "テスト問題文",
      suggestedTopics: [],
    }
    vi.mocked(api.analyzeExercise).mockResolvedValue(mockResult)

    const { result } = renderHook(() => useExerciseAnalyze(), {
      wrapper: createWrapper(),
    })

    const mockFile = new File(["test"], "test.png", { type: "image/png" })

    await act(async () => {
      result.current.analyze(mockFile)
    })

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe("idle")
    expect(result.current.exerciseId).toBeNull()
    expect(result.current.previewUrl).toBeNull()
  })
})

describe("useExerciseConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("確定を実行する", async () => {
    const mockResponse = {
      exerciseId: "ex-1",
      topicId: "topic-1",
      topicChecked: true,
      createdAt: "2024-01-15T10:00:00.000Z",
    }
    vi.mocked(api.confirmExercise).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useExerciseConfirm(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isConfirming).toBe(false)

    await act(async () => {
      result.current.confirm({
        exerciseId: "ex-1",
        topicId: "topic-1",
        markAsUnderstood: true,
      })
    })

    await waitFor(() => {
      expect(api.confirmExercise).toHaveBeenCalledWith(
        "ex-1",
        "topic-1",
        true
      )
    })
  })

  it("確定エラー時にerrorを保持する", async () => {
    vi.mocked(api.confirmExercise).mockRejectedValue(
      new Error("確定に失敗しました")
    )

    const { result } = renderHook(() => useExerciseConfirm(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.confirm({
        exerciseId: "ex-1",
        topicId: "topic-1",
        markAsUnderstood: false,
      })
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })
  })
})

describe("useTopicExercises", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("論点の問題一覧を取得する", async () => {
    const mockExercises = {
      exercises: [
        {
          exerciseId: "ex-1",
          imageId: "img-1",
          ocrText: "問題文",
          markedAsUnderstood: true,
          createdAt: "2024-01-15T10:00:00.000Z",
        },
      ],
    }
    vi.mocked(api.getTopicExercises).mockResolvedValue(mockExercises)

    const { result } = renderHook(() => useTopicExercises("topic-1"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockExercises)
    expect(api.getTopicExercises).toHaveBeenCalledWith("topic-1")
  })

  it("topicIdがundefinedの場合はクエリを実行しない", () => {
    const { result } = renderHook(() => useTopicExercises(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(api.getTopicExercises).not.toHaveBeenCalled()
  })
})
