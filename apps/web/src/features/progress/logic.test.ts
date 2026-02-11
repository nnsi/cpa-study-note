import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { calculateProgressStats, mapSubjectProgress } from "./logic"

describe("calculateProgressStats", () => {
  it("空配列→totalTopics=0, understoodTopics=0, recentlyAccessedTopics=0, completionRate=0", () => {
    const result = calculateProgressStats([], [])
    expect(result).toEqual({
      totalTopics: 0,
      understoodTopics: 0,
      recentlyAccessedTopics: 0,
      completionRate: 0,
    })
  })

  it("totalTopics=0のゼロ除算→completionRate=0（NaNではない）", () => {
    const result = calculateProgressStats([], [])
    expect(result.completionRate).toBe(0)
    expect(Number.isNaN(result.completionRate)).toBe(false)
  })

  it("全understood→completionRate=100", () => {
    const subjectStats = [
      {
        subjectId: "s1",
        subjectName: "科目A",
        totalTopics: 5,
        understoodTopics: 5,
      },
    ]
    const result = calculateProgressStats([], subjectStats)
    expect(result.completionRate).toBe(100)
  })

  it("半分understood→completionRate=50", () => {
    const subjectStats = [
      {
        subjectId: "s1",
        subjectName: "科目A",
        totalTopics: 10,
        understoodTopics: 5,
      },
    ]
    const result = calculateProgressStats([], subjectStats)
    expect(result.completionRate).toBe(50)
  })

  describe("recentlyAccessed の境界値", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("lastAccessedAtがちょうど7日前→recentlyAccessedに含まれない", () => {
      // 7日前 = 2024-06-08T12:00:00.000Z（weekAgoと同じ値なので lastAccess > weekAgo はfalse）
      const progress = [
        { understood: true, lastAccessedAt: "2024-06-08T12:00:00.000Z" },
      ]
      const result = calculateProgressStats(progress, [])
      expect(result.recentlyAccessedTopics).toBe(0)
    })

    it("lastAccessedAtが6日23時間前→recentlyAccessedに含まれる", () => {
      // 6日23時間前 = 2024-06-08T13:00:00.000Z（weekAgoより後なので含まれる）
      const progress = [
        { understood: true, lastAccessedAt: "2024-06-08T13:00:00.000Z" },
      ]
      const result = calculateProgressStats(progress, [])
      expect(result.recentlyAccessedTopics).toBe(1)
    })

    it("lastAccessedAtがnull→recentlyAccessedに含まれない", () => {
      const progress = [{ understood: true, lastAccessedAt: null }]
      const result = calculateProgressStats(progress, [])
      expect(result.recentlyAccessedTopics).toBe(0)
    })
  })
})

describe("mapSubjectProgress", () => {
  it("空配列→空配列", () => {
    expect(mapSubjectProgress([])).toEqual([])
  })

  it("1要素→正しくマッピング", () => {
    const input = [
      {
        subjectId: "s1",
        subjectName: "科目A",
        totalTopics: 10,
        understoodTopics: 5,
      },
    ]
    const result = mapSubjectProgress(input)
    expect(result).toEqual([
      {
        id: "s1",
        name: "科目A",
        totalTopics: 10,
        understoodTopics: 5,
      },
    ])
  })
})
