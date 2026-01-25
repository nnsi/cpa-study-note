import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { useDailyMetrics } from "./hooks"
import * as api from "./api"

vi.mock("./api")

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useDailyMetrics", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("should fetch daily metrics with default range (7 days)", async () => {
    const mockMetrics = {
      metrics: [
        {
          id: "1",
          date: "2024-01-01",
          userId: "user1",
          checkedTopicCount: 5,
          sessionCount: 2,
          messageCount: 10,
          goodQuestionCount: 1,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
    }

    vi.mocked(api.getDailyMetrics).mockResolvedValue(mockMetrics)

    const { result } = renderHook(() => useDailyMetrics(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(api.getDailyMetrics).toHaveBeenCalled()
    expect(result.current.chartData.length).toBeGreaterThan(0)
    expect(result.current.rangeLabel).toBe("直近7日")
  })

  it("should update range when setRange is called", async () => {
    vi.mocked(api.getDailyMetrics).mockResolvedValue({ metrics: [] })

    const { result } = renderHook(() => useDailyMetrics("7days"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.range).toBe("7days")
    expect(result.current.rangeLabel).toBe("直近7日")

    result.current.setRange("30days")

    await waitFor(() => {
      expect(result.current.range).toBe("30days")
    })

    expect(result.current.rangeLabel).toBe("直近30日")
  })

  it("should transform data to chart format", async () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

    const mockMetrics = {
      metrics: [
        {
          id: "1",
          date: dateStr,
          userId: "user1",
          checkedTopicCount: 10,
          sessionCount: 3,
          messageCount: 15,
          goodQuestionCount: 2,
          createdAt: dateStr + "T00:00:00Z",
        },
      ],
    }

    vi.mocked(api.getDailyMetrics).mockResolvedValue(mockMetrics)

    const { result } = renderHook(() => useDailyMetrics(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should have 7 days of data
    expect(result.current.chartData.length).toBe(7)

    // Find today's data point
    const todayData = result.current.chartData.find((d) => d.date === dateStr)
    expect(todayData).toBeDefined()
    expect(todayData?.checkedTopicCount).toBe(10)
    expect(todayData?.sessionCount).toBe(3)
    expect(todayData?.messageCount).toBe(15)
  })
})
