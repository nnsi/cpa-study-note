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
          id: "1",
          date: "2024-01-02",
          userId: "user1",
          checkedTopicCount: 5,
          sessionCount: 2,
          messageCount: 10,
          goodQuestionCount: 1,
          createdAt: "2024-01-02T00:00:00Z",
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
})
