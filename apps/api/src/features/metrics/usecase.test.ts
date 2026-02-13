/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect, vi } from "vitest"
import type {
  MetricsRepository,
  MetricSnapshot,
  DailyAggregation,
  TodayMetrics,
  DailyMetric,
} from "./repository"
import { getDailyMetrics, createSnapshot, getTodayMetrics } from "./usecase"
import { noopLogger } from "../../test/helpers"

// Mock data
const mockMetricSnapshot: MetricSnapshot = {
  id: "snapshot-1",
  date: "2024-01-15",
  userId: "user-1",
  checkedTopicCount: 10,
  sessionCount: 3,
  messageCount: 15,
  goodQuestionCount: 5,
  createdAt: new Date("2024-01-15T23:59:59Z"),
}

const mockDailyAggregation: DailyAggregation = {
  checkedTopicCount: 10,
  sessionCount: 3,
  messageCount: 15,
  goodQuestionCount: 5,
}

const mockTodayMetrics: TodayMetrics = {
  sessionCount: 2,
  messageCount: 8,
  checkedTopicCount: 4,
}

const mockDailyMetrics: DailyMetric[] = [
  {
    date: "2024-01-15",
    checkedTopicCount: 10,
    sessionCount: 3,
    messageCount: 15,
    goodQuestionCount: 5,
  },
  {
    date: "2024-01-16",
    checkedTopicCount: 12,
    sessionCount: 4,
    messageCount: 20,
    goodQuestionCount: 7,
  },
]

// Helper to create mock repository
const createMockRepository = (
  overrides: Partial<MetricsRepository> = {}
): MetricsRepository => ({
  findByDateRange: vi.fn().mockResolvedValue([mockMetricSnapshot]),
  findByDate: vi.fn().mockResolvedValue(mockMetricSnapshot),
  upsert: vi.fn().mockResolvedValue(mockMetricSnapshot),
  aggregateForDate: vi.fn().mockResolvedValue(mockDailyAggregation),
  aggregateToday: vi.fn().mockResolvedValue(mockTodayMetrics),
  aggregateDateRange: vi.fn().mockResolvedValue(mockDailyMetrics),
  ...overrides,
})

describe("Metrics UseCase", () => {
  describe("getDailyMetrics", () => {
    it("should return daily metrics for date range", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await getDailyMetrics(
        deps,
        "user-1",
        "2024-01-15",
        "2024-01-16",
        "Asia/Tokyo"
      )

      expect(metricsRepo.aggregateDateRange).toHaveBeenCalledWith(
        "user-1",
        "2024-01-15",
        "2024-01-16",
        "Asia/Tokyo"
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value).toHaveLength(2)
      expect(result.value[0].date).toBe("2024-01-15")
      expect(result.value[0].checkedTopicCount).toBe(10)
      expect(result.value[0].sessionCount).toBe(3)
      expect(result.value[0].messageCount).toBe(15)
      expect(result.value[0].goodQuestionCount).toBe(5)
      expect(result.value[1].date).toBe("2024-01-16")
    })

    it("should return empty array when no metrics exist", async () => {
      const metricsRepo = createMockRepository({
        aggregateDateRange: vi.fn().mockResolvedValue([]),
      })
      const deps = { metricsRepo, logger: noopLogger }

      const result = await getDailyMetrics(
        deps,
        "user-1",
        "2024-01-15",
        "2024-01-16",
        "Asia/Tokyo"
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value).toHaveLength(0)
    })

    it("should return error for invalid from date format", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await getDailyMetrics(
        deps,
        "user-1",
        "2024/01/15", // Invalid format
        "2024-01-16",
        "Asia/Tokyo"
      )

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("BAD_REQUEST")
      expect(result.error.message).toContain("日付形式が不正です")
      expect(metricsRepo.aggregateDateRange).not.toHaveBeenCalled()
    })

    it("should return error for invalid to date format", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await getDailyMetrics(
        deps,
        "user-1",
        "2024-01-15",
        "01-16-2024", // Invalid format
        "Asia/Tokyo"
      )

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("BAD_REQUEST")
      expect(result.error.message).toContain("日付形式が不正です")
      expect(metricsRepo.aggregateDateRange).not.toHaveBeenCalled()
    })

    it("should return error when from date is after to date", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await getDailyMetrics(
        deps,
        "user-1",
        "2024-01-20", // After to date
        "2024-01-15",
        "Asia/Tokyo"
      )

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("BAD_REQUEST")
      expect(result.error.message).toContain("日付範囲が不正です")
      expect(metricsRepo.aggregateDateRange).not.toHaveBeenCalled()
    })

    it("should accept same date for from and to", async () => {
      const singleDayMetric: DailyMetric[] = [
        {
          date: "2024-01-15",
          checkedTopicCount: 10,
          sessionCount: 3,
          messageCount: 15,
          goodQuestionCount: 5,
        },
      ]
      const metricsRepo = createMockRepository({
        aggregateDateRange: vi.fn().mockResolvedValue(singleDayMetric),
      })
      const deps = { metricsRepo, logger: noopLogger }

      const result = await getDailyMetrics(
        deps,
        "user-1",
        "2024-01-15",
        "2024-01-15",
        "Asia/Tokyo"
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value).toHaveLength(1)
      expect(metricsRepo.aggregateDateRange).toHaveBeenCalledWith(
        "user-1",
        "2024-01-15",
        "2024-01-15",
        "Asia/Tokyo"
      )
    })
  })

  describe("createSnapshot", () => {
    it("should create snapshot for today when no date provided", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await createSnapshot(deps, "user-1")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      // Should call aggregateForDate with some date (today)
      expect(metricsRepo.aggregateForDate).toHaveBeenCalledWith(
        "user-1",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      )
      expect(metricsRepo.upsert).toHaveBeenCalled()
      expect(result.value.id).toBe("snapshot-1")
      expect(result.value.createdAt).toBe("2024-01-15T23:59:59.000Z")
    })

    it("should create snapshot for specific date", async () => {
      const specificDateSnapshot: MetricSnapshot = {
        ...mockMetricSnapshot,
        date: "2024-01-10",
      }
      const metricsRepo = createMockRepository({
        upsert: vi.fn().mockResolvedValue(specificDateSnapshot),
      })
      const deps = { metricsRepo, logger: noopLogger }

      const result = await createSnapshot(deps, "user-1", "2024-01-10")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(metricsRepo.aggregateForDate).toHaveBeenCalledWith(
        "user-1",
        "2024-01-10"
      )
      expect(metricsRepo.upsert).toHaveBeenCalledWith(
        "user-1",
        "2024-01-10",
        mockDailyAggregation
      )
      expect(result.value.date).toBe("2024-01-10")
    })

    it("should return error for invalid date format", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await createSnapshot(deps, "user-1", "2024/01/15")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("BAD_REQUEST")
      expect(result.error.message).toContain("日付形式が不正です")
      expect(metricsRepo.aggregateForDate).not.toHaveBeenCalled()
      expect(metricsRepo.upsert).not.toHaveBeenCalled()
    })

    it("should return error for invalid date format with partial match", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await createSnapshot(deps, "user-1", "2024-1-15")

      expect(result.ok).toBe(false)
      if (result.ok) return

      expect(result.error.code).toBe("BAD_REQUEST")
      expect(metricsRepo.aggregateForDate).not.toHaveBeenCalled()
    })

    it("should convert createdAt to ISO string in response", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await createSnapshot(deps, "user-1", "2024-01-15")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.createdAt).toBe("2024-01-15T23:59:59.000Z")
    })

    it("should pass aggregation data to upsert", async () => {
      const customAggregation: DailyAggregation = {
        checkedTopicCount: 20,
        sessionCount: 5,
        messageCount: 30,
        goodQuestionCount: 10,
      }
      const metricsRepo = createMockRepository({
        aggregateForDate: vi.fn().mockResolvedValue(customAggregation),
      })
      const deps = { metricsRepo, logger: noopLogger }

      await createSnapshot(deps, "user-1", "2024-01-15")

      expect(metricsRepo.upsert).toHaveBeenCalledWith(
        "user-1",
        "2024-01-15",
        customAggregation
      )
    })
  })

  describe("getTodayMetrics", () => {
    it("should return today's metrics", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      const result = await getTodayMetrics(deps, "user-1", "Asia/Tokyo")

      expect(metricsRepo.aggregateToday).toHaveBeenCalledWith(
        "user-1",
        "Asia/Tokyo"
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.sessionCount).toBe(2)
      expect(result.value.messageCount).toBe(8)
      expect(result.value.checkedTopicCount).toBe(4)
    })

    it("should return zero counts when no activity", async () => {
      const emptyMetrics: TodayMetrics = {
        sessionCount: 0,
        messageCount: 0,
        checkedTopicCount: 0,
      }
      const metricsRepo = createMockRepository({
        aggregateToday: vi.fn().mockResolvedValue(emptyMetrics),
      })
      const deps = { metricsRepo, logger: noopLogger }

      const result = await getTodayMetrics(deps, "user-1", "UTC")

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.sessionCount).toBe(0)
      expect(result.value.messageCount).toBe(0)
      expect(result.value.checkedTopicCount).toBe(0)
    })

    it("should pass different timezones correctly", async () => {
      const metricsRepo = createMockRepository()
      const deps = { metricsRepo, logger: noopLogger }

      await getTodayMetrics(deps, "user-1", "America/New_York")

      expect(metricsRepo.aggregateToday).toHaveBeenCalledWith(
        "user-1",
        "America/New_York"
      )
    })
  })
})
