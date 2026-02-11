import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  buildFilterQueryString,
  parseFilterFromQueryString,
  isFilterEmpty,
  groupTopicsBySubject,
  formatLastChatDate,
  summarizeFilters,
} from "./logic"
import type { FilteredTopic } from "./api"

describe("buildFilterQueryString", () => {
  it("空のパラメータの場合は空文字を返す", () => {
    expect(buildFilterQueryString({})).toBe("")
  })

  it("minSessionCountを含む", () => {
    expect(buildFilterQueryString({ minSessionCount: 3 })).toBe(
      "?minSessionCount=3"
    )
  })

  it("daysSinceLastChatを含む", () => {
    expect(buildFilterQueryString({ daysSinceLastChat: 7 })).toBe(
      "?daysSinceLastChat=7"
    )
  })

  it("understoodを含む", () => {
    expect(buildFilterQueryString({ understood: true })).toBe(
      "?understood=true"
    )
    expect(buildFilterQueryString({ understood: false })).toBe(
      "?understood=false"
    )
  })

  it("minGoodQuestionCountを含む", () => {
    expect(buildFilterQueryString({ minGoodQuestionCount: 5 })).toBe(
      "?minGoodQuestionCount=5"
    )
  })

  it("0の値はクエリに含めない", () => {
    expect(
      buildFilterQueryString({ minSessionCount: 0, daysSinceLastChat: 0 })
    ).toBe("")
  })

  it("複数のパラメータを組み合わせる", () => {
    const result = buildFilterQueryString({
      minSessionCount: 2,
      understood: false,
    })
    expect(result).toContain("minSessionCount=2")
    expect(result).toContain("understood=false")
    expect(result.startsWith("?")).toBe(true)
  })
})

describe("parseFilterFromQueryString", () => {
  it("空のURLSearchParamsの場合は空オブジェクトを返す", () => {
    const params = new URLSearchParams()
    expect(parseFilterFromQueryString(params)).toEqual({})
  })

  it("minSessionCountをパースする", () => {
    const params = new URLSearchParams("minSessionCount=3")
    expect(parseFilterFromQueryString(params)).toEqual({
      minSessionCount: 3,
    })
  })

  it("daysSinceLastChatをパースする", () => {
    const params = new URLSearchParams("daysSinceLastChat=7")
    expect(parseFilterFromQueryString(params)).toEqual({
      daysSinceLastChat: 7,
    })
  })

  it("understood=trueをパースする", () => {
    const params = new URLSearchParams("understood=true")
    expect(parseFilterFromQueryString(params)).toEqual({
      understood: true,
    })
  })

  it("understood=falseをパースする", () => {
    const params = new URLSearchParams("understood=false")
    expect(parseFilterFromQueryString(params)).toEqual({
      understood: false,
    })
  })

  it("minGoodQuestionCountをパースする", () => {
    const params = new URLSearchParams("minGoodQuestionCount=5")
    expect(parseFilterFromQueryString(params)).toEqual({
      minGoodQuestionCount: 5,
    })
  })

  it("複数パラメータをパースする", () => {
    const params = new URLSearchParams(
      "minSessionCount=2&understood=false&daysSinceLastChat=14"
    )
    expect(parseFilterFromQueryString(params)).toEqual({
      minSessionCount: 2,
      understood: false,
      daysSinceLastChat: 14,
    })
  })
})

describe("isFilterEmpty", () => {
  it("空オブジェクトの場合trueを返す", () => {
    expect(isFilterEmpty({})).toBe(true)
  })

  it("全てundefinedの場合trueを返す", () => {
    expect(
      isFilterEmpty({
        minSessionCount: undefined,
        daysSinceLastChat: undefined,
        understood: undefined,
        minGoodQuestionCount: undefined,
      })
    ).toBe(true)
  })

  it("いずれかの値がある場合falseを返す", () => {
    expect(isFilterEmpty({ minSessionCount: 1 })).toBe(false)
    expect(isFilterEmpty({ understood: true })).toBe(false)
    expect(isFilterEmpty({ daysSinceLastChat: 7 })).toBe(false)
    expect(isFilterEmpty({ minGoodQuestionCount: 3 })).toBe(false)
  })
})

describe("groupTopicsBySubject", () => {
  const createTopic = (overrides: Partial<FilteredTopic> = {}): FilteredTopic => ({
    id: "topic-1",
    name: "テスト論点",
    subjectId: "subject-1",
    subjectName: "テスト科目",
    categoryId: "cat-1",
    understood: false,
    lastChatAt: null,
    sessionCount: 0,
    goodQuestionCount: 0,
    ...overrides,
  })

  it("空配列の場合は空Mapを返す", () => {
    const result = groupTopicsBySubject([])
    expect(result.size).toBe(0)
  })

  it("同一科目の論点をグループ化する", () => {
    const topics: FilteredTopic[] = [
      createTopic({ id: "t1", subjectId: "s1", subjectName: "科目A" }),
      createTopic({ id: "t2", subjectId: "s1", subjectName: "科目A" }),
    ]

    const result = groupTopicsBySubject(topics)

    expect(result.size).toBe(1)
    expect(result.get("s1")?.topics).toHaveLength(2)
    expect(result.get("s1")?.subjectName).toBe("科目A")
  })

  it("異なる科目を別グループに分ける", () => {
    const topics: FilteredTopic[] = [
      createTopic({ id: "t1", subjectId: "s1", subjectName: "科目A" }),
      createTopic({ id: "t2", subjectId: "s2", subjectName: "科目B" }),
      createTopic({ id: "t3", subjectId: "s1", subjectName: "科目A" }),
    ]

    const result = groupTopicsBySubject(topics)

    expect(result.size).toBe(2)
    expect(result.get("s1")?.topics).toHaveLength(2)
    expect(result.get("s2")?.topics).toHaveLength(1)
  })
})

describe("formatLastChatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("nullの場合「チャットなし」を返す", () => {
    expect(formatLastChatDate(null)).toBe("チャットなし")
  })

  it("今日の場合「今日」を返す", () => {
    expect(formatLastChatDate("2024-06-15T10:00:00.000Z")).toBe("今日")
  })

  it("昨日の場合「昨日」を返す", () => {
    expect(formatLastChatDate("2024-06-14T10:00:00.000Z")).toBe("昨日")
  })

  it("2〜6日前の場合「N日前」を返す", () => {
    expect(formatLastChatDate("2024-06-12T10:00:00.000Z")).toBe("3日前")
  })

  it("7〜29日前の場合「N週間前」を返す", () => {
    expect(formatLastChatDate("2024-06-01T10:00:00.000Z")).toBe("2週間前")
  })

  it("30〜364日前の場合「Nヶ月前」を返す", () => {
    expect(formatLastChatDate("2024-03-15T10:00:00.000Z")).toBe("3ヶ月前")
  })

  it("1年以上前の場合は日付を表示する", () => {
    const result = formatLastChatDate("2023-01-15T10:00:00.000Z")
    // 日付形式であることを確認（ロケール依存のため正確な文字列は検証しない）
    expect(result).not.toBe("チャットなし")
    expect(result).toContain("2023")
  })
})

describe("summarizeFilters", () => {
  it("空のパラメータの場合は空配列を返す", () => {
    expect(summarizeFilters({})).toEqual([])
  })

  it("understood=trueの場合「チェック済み」を含む", () => {
    expect(summarizeFilters({ understood: true })).toContain("チェック済み")
  })

  it("understood=falseの場合「未チェック」を含む", () => {
    expect(summarizeFilters({ understood: false })).toContain("未チェック")
  })

  it("minSessionCountを含む", () => {
    const result = summarizeFilters({ minSessionCount: 3 })
    expect(result).toContain("3セッション以上")
  })

  it("daysSinceLastChatを含む", () => {
    const result = summarizeFilters({ daysSinceLastChat: 7 })
    expect(result).toContain("7日以上経過")
  })

  it("minGoodQuestionCountを含む", () => {
    const result = summarizeFilters({ minGoodQuestionCount: 5 })
    expect(result).toContain("良質な質問5件以上")
  })

  it("0の値は含めない", () => {
    const result = summarizeFilters({
      minSessionCount: 0,
      daysSinceLastChat: 0,
      minGoodQuestionCount: 0,
    })
    expect(result).toEqual([])
  })

  it("複数条件を組み合わせる", () => {
    const result = summarizeFilters({
      understood: true,
      minSessionCount: 2,
      daysSinceLastChat: 14,
    })
    expect(result).toHaveLength(3)
    expect(result).toContain("チェック済み")
    expect(result).toContain("2セッション以上")
    expect(result).toContain("14日以上経過")
  })

  it("負の値（minSessionCount: -1）は含めない", () => {
    const result = summarizeFilters({ minSessionCount: -1 })
    expect(result).toEqual([])
  })

  it("境界値（minSessionCount: 1）は含める", () => {
    const result = summarizeFilters({ minSessionCount: 1 })
    expect(result).toContain("1セッション以上")
  })
})

// ========================================
// 境界値テスト
// ========================================

describe("buildFilterQueryString - 境界値", () => {
  it("負の値（minSessionCount: -1）は含めない", () => {
    expect(buildFilterQueryString({ minSessionCount: -1 })).toBe("")
  })

  it("境界値（minSessionCount: 1）は含める", () => {
    expect(buildFilterQueryString({ minSessionCount: 1 })).toBe(
      "?minSessionCount=1"
    )
  })
})

describe("parseFilterFromQueryString - 境界値", () => {
  it("NaN入力（'abc'）→そのフィールドがNaNになる", () => {
    const params = new URLSearchParams("minSessionCount=abc")
    const result = parseFilterFromQueryString(params)
    expect(result.minSessionCount).toBeNaN()
  })

  it("understood='TRUE'（大文字）→undefinedになる", () => {
    const params = new URLSearchParams("understood=TRUE")
    const result = parseFilterFromQueryString(params)
    expect(result.understood).toBeUndefined()
  })

  it("understood='yes'→undefinedになる", () => {
    const params = new URLSearchParams("understood=yes")
    const result = parseFilterFromQueryString(params)
    expect(result.understood).toBeUndefined()
  })
})

describe("formatLastChatDate - 境界値", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("ちょうど7日前（diffDays=7）→「1週間前」", () => {
    // 7日前 = 2024-06-08T12:00:00.000Z
    expect(formatLastChatDate("2024-06-08T12:00:00.000Z")).toBe("1週間前")
  })

  it("6日前（diffDays=6）→「6日前」", () => {
    // 6日前 = 2024-06-09T12:00:00.000Z
    expect(formatLastChatDate("2024-06-09T12:00:00.000Z")).toBe("6日前")
  })

  it("ちょうど30日前（diffDays=30）→「1ヶ月前」", () => {
    // 30日前 = 2024-05-16T12:00:00.000Z
    expect(formatLastChatDate("2024-05-16T12:00:00.000Z")).toBe("1ヶ月前")
  })

  it("29日前（diffDays=29）→「4週間前」", () => {
    // 29日前 = 2024-05-17T12:00:00.000Z
    expect(formatLastChatDate("2024-05-17T12:00:00.000Z")).toBe("4週間前")
  })

  it("ちょうど365日前→日付表示", () => {
    // 365日前 = 2023-06-16T12:00:00.000Z
    const result = formatLastChatDate("2023-06-16T12:00:00.000Z")
    expect(result).toContain("2023")
    expect(result).not.toContain("ヶ月前")
  })

  it("364日前→「12ヶ月前」", () => {
    // 364日前 = 2023-06-17T12:00:00.000Z
    expect(formatLastChatDate("2023-06-17T12:00:00.000Z")).toBe("12ヶ月前")
  })
})
