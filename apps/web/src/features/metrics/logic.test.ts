import { describe, it, expect } from "vitest"
import {
  getDateRangeParams,
  formatDate,
  formatDisplayDate,
  generateDateRange,
  transformToChartData,
  getRangeLabel,
} from "./logic"
import type { DailyMetric } from "./api"

describe("logic", () => {
  describe("formatDate", () => {
    it("should format date as YYYY-MM-DD", () => {
      const date = new Date(2024, 0, 15) // January 15, 2024
      expect(formatDate(date)).toBe("2024-01-15")
    })

    it("should pad single digit month and day", () => {
      const date = new Date(2024, 8, 5) // September 5, 2024
      expect(formatDate(date)).toBe("2024-09-05")
    })
  })

  describe("formatDisplayDate", () => {
    it("should format date as M/D without leading zeros", () => {
      expect(formatDisplayDate("2024-01-05")).toBe("1/5")
      expect(formatDisplayDate("2024-12-25")).toBe("12/25")
    })
  })

  describe("getDateRangeParams", () => {
    it("should return from and to for 7 days range", () => {
      const { from, to } = getDateRangeParams("7days")
      const fromDate = new Date(from)
      const toDate = new Date(to)
      const diffDays =
        Math.ceil(
          (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      expect(diffDays).toBe(7)
    })

    it("should return from and to for 30 days range", () => {
      const { from, to } = getDateRangeParams("30days")
      const fromDate = new Date(from)
      const toDate = new Date(to)
      const diffDays =
        Math.ceil(
          (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      expect(diffDays).toBe(30)
    })

    it("should return from and to for 90 days range", () => {
      const { from, to } = getDateRangeParams("90days")
      const fromDate = new Date(from)
      const toDate = new Date(to)
      const diffDays =
        Math.ceil(
          (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      expect(diffDays).toBe(90)
    })
  })

  describe("generateDateRange", () => {
    it("should generate array of dates between from and to", () => {
      const result = generateDateRange("2024-01-01", "2024-01-05")
      expect(result).toEqual([
        "2024-01-01",
        "2024-01-02",
        "2024-01-03",
        "2024-01-04",
        "2024-01-05",
      ])
    })

    it("should return single date if from equals to", () => {
      const result = generateDateRange("2024-01-01", "2024-01-01")
      expect(result).toEqual(["2024-01-01"])
    })
  })

  describe("transformToChartData", () => {
    it("should transform metrics to chart data with missing dates filled with zeros", () => {
      const metrics: DailyMetric[] = [
        {
          date: "2024-01-02",
          checkedTopicCount: 5,
          sessionCount: 2,
          messageCount: 10,
          goodQuestionCount: 1,
        },
      ]

      const result = transformToChartData(metrics, "2024-01-01", "2024-01-03")

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        date: "2024-01-01",
        displayDate: "1/1",
        checkedTopicCount: 0,
        sessionCount: 0,
        messageCount: 0,
        goodQuestionCount: 0,
      })
      expect(result[1]).toEqual({
        date: "2024-01-02",
        displayDate: "1/2",
        checkedTopicCount: 5,
        sessionCount: 2,
        messageCount: 10,
        goodQuestionCount: 1,
      })
      expect(result[2]).toEqual({
        date: "2024-01-03",
        displayDate: "1/3",
        checkedTopicCount: 0,
        sessionCount: 0,
        messageCount: 0,
        goodQuestionCount: 0,
      })
    })

    it("should handle empty metrics array", () => {
      const result = transformToChartData([], "2024-01-01", "2024-01-02")

      expect(result).toHaveLength(2)
      expect(result[0].checkedTopicCount).toBe(0)
      expect(result[1].checkedTopicCount).toBe(0)
    })
  })

  describe("getRangeLabel", () => {
    it("should return correct labels for each range", () => {
      expect(getRangeLabel("7days")).toBe("直近7日")
      expect(getRangeLabel("30days")).toBe("直近30日")
      expect(getRangeLabel("90days")).toBe("直近90日")
    })
  })

  // ========================================
  // 境界値テスト
  // ========================================

  describe("formatDate - 境界値", () => {
    it("1月1日（年の最初の日）", () => {
      expect(formatDate(new Date(2024, 0, 1))).toBe("2024-01-01")
    })

    it("12月31日（年の最後の日）", () => {
      expect(formatDate(new Date(2024, 11, 31))).toBe("2024-12-31")
    })

    it("うるう年2月29日", () => {
      expect(formatDate(new Date(2024, 1, 29))).toBe("2024-02-29")
    })
  })

  describe("formatDisplayDate - 境界値", () => {
    it("最小月日（1/1）", () => {
      expect(formatDisplayDate("2024-01-01")).toBe("1/1")
    })

    it("最大月日（12/31）", () => {
      expect(formatDisplayDate("2024-12-31")).toBe("12/31")
    })
  })

  describe("generateDateRange - 境界値", () => {
    it("from > to（逆順）→空配列", () => {
      const result = generateDateRange("2024-01-05", "2024-01-01")
      expect(result).toEqual([])
    })

    it("月跨ぎ（1/30→2/2で4日分）", () => {
      const result = generateDateRange("2024-01-30", "2024-02-02")
      expect(result).toEqual([
        "2024-01-30",
        "2024-01-31",
        "2024-02-01",
        "2024-02-02",
      ])
    })

    it("うるう年（2/28→3/1で3日分）", () => {
      const result = generateDateRange("2024-02-28", "2024-03-01")
      expect(result).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"])
    })
  })

  describe("transformToChartData - 境界値", () => {
    it("metricsに範囲外の日付があっても無視される", () => {
      const metrics: DailyMetric[] = [
        {
          date: "2023-12-31",
          checkedTopicCount: 99,
          sessionCount: 99,
          messageCount: 99,
          goodQuestionCount: 99,
        },
      ]

      const result = transformToChartData(metrics, "2024-01-01", "2024-01-02")

      expect(result).toHaveLength(2)
      expect(result[0].checkedTopicCount).toBe(0)
      expect(result[1].checkedTopicCount).toBe(0)
    })

    it("重複日付（Mapなので後勝ち）", () => {
      const metrics: DailyMetric[] = [
        {
          date: "2024-01-01",
          checkedTopicCount: 1,
          sessionCount: 1,
          messageCount: 1,
          goodQuestionCount: 1,
        },
        {
          date: "2024-01-01",
          checkedTopicCount: 5,
          sessionCount: 5,
          messageCount: 5,
          goodQuestionCount: 5,
        },
      ]

      const result = transformToChartData(metrics, "2024-01-01", "2024-01-01")

      expect(result).toHaveLength(1)
      expect(result[0].checkedTopicCount).toBe(5)
      expect(result[0].sessionCount).toBe(5)
    })
  })
})
