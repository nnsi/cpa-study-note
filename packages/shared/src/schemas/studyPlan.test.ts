import { describe, it, expect } from "vitest"
import {
  studyPlanScopeSchema,
  studyPlanResponseSchema,
  studyPlanItemResponseSchema,
  studyPlanRevisionResponseSchema,
  studyPlanDetailResponseSchema,
  studyPlanListResponseSchema,
  createStudyPlanRequestSchema,
  updateStudyPlanRequestSchema,
  createStudyPlanItemRequestSchema,
  updateStudyPlanItemRequestSchema,
  reorderStudyPlanItemsRequestSchema,
  createStudyPlanRevisionRequestSchema,
  updateStudyPlanRevisionRequestSchema,
  studyPlanParamsSchema,
  studyPlanItemParamsSchema,
  studyPlanRevisionParamsSchema,
  suggestPlanItemsRequestSchema,
  planItemSuggestionSchema,
  planAssistantChunkSchema,
} from "./studyPlan"

const validPlan = {
  id: "plan-1",
  userId: "user-1",
  title: "学習計画",
  intent: "体系的に学ぶ",
  scope: "subject" as const,
  subjectId: "sub-1",
  subjectName: "財務会計論",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  archivedAt: null,
}

describe("studyPlanScopeSchema", () => {
  it("有効な値をパースできる", () => {
    expect(studyPlanScopeSchema.safeParse("all").success).toBe(true)
    expect(studyPlanScopeSchema.safeParse("subject").success).toBe(true)
    expect(studyPlanScopeSchema.safeParse("topic_group").success).toBe(true)
  })

  it("無効な値でエラー", () => {
    expect(studyPlanScopeSchema.safeParse("domain").success).toBe(false)
  })
})

describe("studyPlanResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = studyPlanResponseSchema.safeParse(validPlan)
    expect(result.success).toBe(true)
  })

  it("nullableフィールドがnullでも有効", () => {
    const result = studyPlanResponseSchema.safeParse({
      ...validPlan,
      intent: null,
      subjectId: null,
      subjectName: null,
      archivedAt: null,
    })
    expect(result.success).toBe(true)
  })
})

describe("studyPlanItemResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = studyPlanItemResponseSchema.safeParse({
      id: "item-1",
      studyPlanId: "plan-1",
      topicId: "topic-1",
      topicName: "論点名",
      description: "この論点を学習する",
      rationale: "重要だから",
      orderIndex: 0,
      createdAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })

  it("topicIdとtopicNameがnullでも有効", () => {
    const result = studyPlanItemResponseSchema.safeParse({
      id: "item-1",
      studyPlanId: "plan-1",
      topicId: null,
      topicName: null,
      description: "自由テキストの計画要素",
      rationale: null,
      orderIndex: 1,
      createdAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })
})

describe("studyPlanRevisionResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = studyPlanRevisionResponseSchema.safeParse({
      id: "rev-1",
      studyPlanId: "plan-1",
      summary: "初回作成",
      reason: null,
      createdAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })
})

describe("studyPlanDetailResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = studyPlanDetailResponseSchema.safeParse({
      plan: validPlan,
      items: [],
      revisions: [],
    })
    expect(result.success).toBe(true)
  })
})

describe("studyPlanListResponseSchema", () => {
  it("itemCount付きの計画一覧をパースできる", () => {
    const result = studyPlanListResponseSchema.safeParse({
      plans: [{ ...validPlan, itemCount: 5 }],
    })
    expect(result.success).toBe(true)
  })

  it("空配列でも有効", () => {
    const result = studyPlanListResponseSchema.safeParse({ plans: [] })
    expect(result.success).toBe(true)
  })
})

describe("createStudyPlanRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = createStudyPlanRequestSchema.safeParse({
      title: "新しい計画",
      scope: "all",
    })
    expect(result.success).toBe(true)
  })

  it("titleが空文字でエラー", () => {
    const result = createStudyPlanRequestSchema.safeParse({
      title: "",
      scope: "all",
    })
    expect(result.success).toBe(false)
  })

  it("titleが200文字超でエラー", () => {
    const result = createStudyPlanRequestSchema.safeParse({
      title: "a".repeat(201),
      scope: "all",
    })
    expect(result.success).toBe(false)
  })

  it("intentが2000文字超でエラー", () => {
    const result = createStudyPlanRequestSchema.safeParse({
      title: "計画",
      scope: "subject",
      intent: "a".repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it("subjectIdはオプション", () => {
    const result = createStudyPlanRequestSchema.safeParse({
      title: "計画",
      scope: "subject",
      subjectId: "sub-1",
    })
    expect(result.success).toBe(true)
  })
})

describe("updateStudyPlanRequestSchema", () => {
  it("全フィールド省略でも有効", () => {
    const result = updateStudyPlanRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("nullableフィールドにnullを設定できる", () => {
    const result = updateStudyPlanRequestSchema.safeParse({
      intent: null,
      subjectId: null,
    })
    expect(result.success).toBe(true)
  })
})

describe("createStudyPlanItemRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "学習項目",
      orderIndex: 0,
    })
    expect(result.success).toBe(true)
  })

  it("descriptionが空文字でエラー", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "",
      orderIndex: 0,
    })
    expect(result.success).toBe(false)
  })

  it("descriptionが2000文字超でエラー", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "a".repeat(2001),
      orderIndex: 0,
    })
    expect(result.success).toBe(false)
  })

  it("orderIndexが負でエラー", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "学習項目",
      orderIndex: -1,
    })
    expect(result.success).toBe(false)
  })

  it("orderIndexが小数でエラー", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "学習項目",
      orderIndex: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe("updateStudyPlanItemRequestSchema", () => {
  it("全フィールド省略でも有効", () => {
    const result = updateStudyPlanItemRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe("reorderStudyPlanItemsRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = reorderStudyPlanItemsRequestSchema.safeParse({
      itemIds: ["item-1", "item-2"],
    })
    expect(result.success).toBe(true)
  })

  it("空配列でエラー", () => {
    const result = reorderStudyPlanItemsRequestSchema.safeParse({ itemIds: [] })
    expect(result.success).toBe(false)
  })
})

describe("createStudyPlanRevisionRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({
      summary: "計画を修正",
    })
    expect(result.success).toBe(true)
  })

  it("summaryが空文字でエラー", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({ summary: "" })
    expect(result.success).toBe(false)
  })

  it("summaryが2000文字超でエラー", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({
      summary: "a".repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it("reasonはオプション", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({
      summary: "修正",
      reason: "理由テキスト",
    })
    expect(result.success).toBe(true)
  })
})

describe("updateStudyPlanRevisionRequestSchema", () => {
  it("全フィールド省略でも有効", () => {
    const result = updateStudyPlanRevisionRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("reasonにnullを設定できる", () => {
    const result = updateStudyPlanRevisionRequestSchema.safeParse({ reason: null })
    expect(result.success).toBe(true)
  })
})

describe("studyPlanParamsSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = studyPlanParamsSchema.safeParse({ planId: "plan-1" })
    expect(result.success).toBe(true)
  })
})

describe("studyPlanItemParamsSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = studyPlanItemParamsSchema.safeParse({
      planId: "plan-1",
      itemId: "item-1",
    })
    expect(result.success).toBe(true)
  })
})

describe("studyPlanRevisionParamsSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = studyPlanRevisionParamsSchema.safeParse({
      planId: "plan-1",
      revisionId: "rev-1",
    })
    expect(result.success).toBe(true)
  })
})

describe("suggestPlanItemsRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = suggestPlanItemsRequestSchema.safeParse({
      prompt: "財務会計の学習計画を提案して",
    })
    expect(result.success).toBe(true)
  })

  it("promptが空文字でエラー", () => {
    const result = suggestPlanItemsRequestSchema.safeParse({ prompt: "" })
    expect(result.success).toBe(false)
  })

  it("promptが2000文字超でエラー", () => {
    const result = suggestPlanItemsRequestSchema.safeParse({
      prompt: "a".repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe("planItemSuggestionSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = planItemSuggestionSchema.safeParse({
      items: [
        {
          description: "学習項目",
          rationale: "理由",
          topicName: "論点名",
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("rationaleとtopicNameがnullでも有効（デフォルト値）", () => {
    const result = planItemSuggestionSchema.safeParse({
      items: [{ description: "学習項目" }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].rationale).toBeNull()
      expect(result.data.items[0].topicName).toBeNull()
    }
  })

  it("空配列でも有効", () => {
    const result = planItemSuggestionSchema.safeParse({ items: [] })
    expect(result.success).toBe(true)
  })
})

describe("planAssistantChunkSchema", () => {
  it("textチャンクをパースできる", () => {
    const result = planAssistantChunkSchema.safeParse({
      type: "text",
      content: "回答テキスト",
    })
    expect(result.success).toBe(true)
  })

  it("errorチャンクをパースできる", () => {
    const result = planAssistantChunkSchema.safeParse({
      type: "error",
      error: "エラー内容",
    })
    expect(result.success).toBe(true)
  })

  it("doneチャンクをパースできる", () => {
    const result = planAssistantChunkSchema.safeParse({ type: "done" })
    expect(result.success).toBe(true)
  })

  it("無効なtypeでエラー", () => {
    const result = planAssistantChunkSchema.safeParse({ type: "invalid" })
    expect(result.success).toBe(false)
  })
})

// ===== 境界値テスト =====

describe("createStudyPlanRequestSchema - 境界値", () => {
  it("titleがちょうど200文字でOK（max境界）", () => {
    const result = createStudyPlanRequestSchema.safeParse({
      title: "a".repeat(200),
      scope: "all",
    })
    expect(result.success).toBe(true)
  })

  it("titleが1文字でOK（min境界）", () => {
    const result = createStudyPlanRequestSchema.safeParse({
      title: "a",
      scope: "all",
    })
    expect(result.success).toBe(true)
  })

  it("intentがちょうど2000文字でOK（max境界）", () => {
    const result = createStudyPlanRequestSchema.safeParse({
      title: "計画",
      scope: "all",
      intent: "a".repeat(2000),
    })
    expect(result.success).toBe(true)
  })
})

describe("createStudyPlanItemRequestSchema - 境界値", () => {
  it("descriptionがちょうど2000文字でOK（max境界）", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "a".repeat(2000),
      orderIndex: 0,
    })
    expect(result.success).toBe(true)
  })

  it("descriptionが1文字でOK（min境界）", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "a",
      orderIndex: 0,
    })
    expect(result.success).toBe(true)
  })

  it("rationaleがちょうど2000文字でOK（max境界）", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "学習項目",
      rationale: "a".repeat(2000),
      orderIndex: 0,
    })
    expect(result.success).toBe(true)
  })

  it("rationaleが2001文字でNG（max超過）", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "学習項目",
      rationale: "a".repeat(2001),
      orderIndex: 0,
    })
    expect(result.success).toBe(false)
  })

  it("orderIndexが0でOK（min境界）", () => {
    const result = createStudyPlanItemRequestSchema.safeParse({
      description: "学習項目",
      orderIndex: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe("updateStudyPlanItemRequestSchema - 境界値", () => {
  it("orderIndexが-1でNG（min未満）", () => {
    const result = updateStudyPlanItemRequestSchema.safeParse({
      orderIndex: -1,
    })
    expect(result.success).toBe(false)
  })

  it("orderIndexが0でOK（min境界）", () => {
    const result = updateStudyPlanItemRequestSchema.safeParse({
      orderIndex: 0,
    })
    expect(result.success).toBe(true)
  })

  it("orderIndexが1.5でNG（int制約）", () => {
    const result = updateStudyPlanItemRequestSchema.safeParse({
      orderIndex: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe("createStudyPlanRevisionRequestSchema - 境界値", () => {
  it("summaryがちょうど2000文字でOK（max境界）", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({
      summary: "a".repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it("summaryが1文字でOK（min境界）", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({
      summary: "a",
    })
    expect(result.success).toBe(true)
  })

  it("reasonがちょうど2000文字でOK（max境界）", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({
      summary: "修正",
      reason: "a".repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it("reasonが2001文字でNG（max超過）", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({
      summary: "修正",
      reason: "a".repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it("reasonが1文字でOK（min境界）", () => {
    const result = createStudyPlanRevisionRequestSchema.safeParse({
      summary: "修正",
      reason: "a",
    })
    expect(result.success).toBe(true)
  })
})

describe("updateStudyPlanRevisionRequestSchema - 境界値", () => {
  it("reasonがちょうど2000文字でOK（max境界）", () => {
    const result = updateStudyPlanRevisionRequestSchema.safeParse({
      reason: "a".repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it("reasonが2001文字でNG（max超過）", () => {
    const result = updateStudyPlanRevisionRequestSchema.safeParse({
      reason: "a".repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe("suggestPlanItemsRequestSchema - 境界値", () => {
  it("promptがちょうど2000文字でOK（max境界）", () => {
    const result = suggestPlanItemsRequestSchema.safeParse({
      prompt: "a".repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it("promptが1文字でOK（min境界）", () => {
    const result = suggestPlanItemsRequestSchema.safeParse({
      prompt: "a",
    })
    expect(result.success).toBe(true)
  })
})

describe("reorderStudyPlanItemsRequestSchema - 境界値", () => {
  it("itemIdsが1要素でOK（min(1)境界）", () => {
    const result = reorderStudyPlanItemsRequestSchema.safeParse({
      itemIds: ["item-1"],
    })
    expect(result.success).toBe(true)
  })
})
