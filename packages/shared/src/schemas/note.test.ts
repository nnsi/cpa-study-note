import { describe, it, expect } from "vitest"
import {
  noteSourceSchema,
  noteSchema,
  noteWithSourceSchema,
  createNoteFromSessionRequestSchema,
  createManualNoteRequestSchema,
  updateNoteRequestSchema,
  noteDetailResponseSchema,
  noteSingleResponseSchema,
  noteBySessionResponseSchema,
  noteCreateResponseSchema,
  notesListResponseSchema,
  noteListItemSchema,
  notesFullListResponseSchema,
} from "./note"

const validNote = {
  id: "note-1",
  userId: "user-1",
  topicId: "topic-1",
  sessionId: "session-1",
  aiSummary: "要約テキスト",
  userMemo: "メモ",
  keyPoints: ["ポイント1"],
  stumbledPoints: ["つまずき1"],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
}

describe("noteSourceSchema", () => {
  it("有効な値をパースできる", () => {
    expect(noteSourceSchema.safeParse("chat").success).toBe(true)
    expect(noteSourceSchema.safeParse("manual").success).toBe(true)
  })

  it("無効な値でエラー", () => {
    expect(noteSourceSchema.safeParse("invalid").success).toBe(false)
  })
})

describe("noteSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = noteSchema.safeParse(validNote)
    expect(result.success).toBe(true)
  })

  it("sessionIdがnullでもパースできる", () => {
    const result = noteSchema.safeParse({ ...validNote, sessionId: null })
    expect(result.success).toBe(true)
  })

  it("aiSummary, userMemoがnullでもパースできる", () => {
    const result = noteSchema.safeParse({
      ...validNote,
      aiSummary: null,
      userMemo: null,
    })
    expect(result.success).toBe(true)
  })

  it("必須フィールド欠落でエラー", () => {
    const result = noteSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("keyPointsが配列でない場合エラー", () => {
    const result = noteSchema.safeParse({ ...validNote, keyPoints: "not-array" })
    expect(result.success).toBe(false)
  })

  it("createdAtが不正なdatetimeでエラー", () => {
    const result = noteSchema.safeParse({ ...validNote, createdAt: "not-a-date" })
    expect(result.success).toBe(false)
  })
})

describe("noteWithSourceSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = noteWithSourceSchema.safeParse({
      ...validNote,
      source: "chat",
    })
    expect(result.success).toBe(true)
  })

  it("source欠落でエラー", () => {
    const result = noteWithSourceSchema.safeParse(validNote)
    expect(result.success).toBe(false)
  })
})

describe("createNoteFromSessionRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = createNoteFromSessionRequestSchema.safeParse({
      sessionId: "session-1",
    })
    expect(result.success).toBe(true)
  })

  it("sessionId欠落でエラー", () => {
    const result = createNoteFromSessionRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("createManualNoteRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "メモ内容",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.keyPoints).toEqual([])
      expect(result.data.stumbledPoints).toEqual([])
    }
  })

  it("userMemoが空文字でエラー", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "",
    })
    expect(result.success).toBe(false)
  })

  it("userMemoが10000文字超でエラー", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "a".repeat(10001),
    })
    expect(result.success).toBe(false)
  })

  it("keyPointsの各要素が1000文字以内で有効", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "memo",
      keyPoints: ["a".repeat(1000)],
    })
    expect(result.success).toBe(true)
  })

  it("keyPointsの各要素が1000文字超でエラー", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "memo",
      keyPoints: ["a".repeat(1001)],
    })
    expect(result.success).toBe(false)
  })

  it("keyPointsが50件超でエラー", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "memo",
      keyPoints: Array.from({ length: 51 }, (_, i) => `point-${i}`),
    })
    expect(result.success).toBe(false)
  })
})

describe("updateNoteRequestSchema", () => {
  it("全フィールド省略でも有効", () => {
    const result = updateNoteRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("userMemoが50000文字以内で有効", () => {
    const result = updateNoteRequestSchema.safeParse({
      userMemo: "a".repeat(50000),
    })
    expect(result.success).toBe(true)
  })

  it("userMemoが50000文字超でエラー", () => {
    const result = updateNoteRequestSchema.safeParse({
      userMemo: "a".repeat(50001),
    })
    expect(result.success).toBe(false)
  })
})

describe("noteDetailResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = noteDetailResponseSchema.safeParse({
      ...validNote,
      source: "manual",
      topicName: "論点名",
      categoryId: "cat-1",
      subjectId: "sub-1",
      subjectName: "科目名",
    })
    expect(result.success).toBe(true)
  })
})

describe("noteSingleResponseSchema", () => {
  it("noteオブジェクトでラップされたレスポンスをパースできる", () => {
    const result = noteSingleResponseSchema.safeParse({
      note: {
        ...validNote,
        source: "chat",
        topicName: "論点名",
        categoryId: "cat-1",
        subjectId: "sub-1",
        subjectName: "科目名",
      },
    })
    expect(result.success).toBe(true)
  })
})

describe("noteBySessionResponseSchema", () => {
  it("noteがnullの場合もパースできる", () => {
    const result = noteBySessionResponseSchema.safeParse({ note: null })
    expect(result.success).toBe(true)
  })
})

describe("noteCreateResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = noteCreateResponseSchema.safeParse({
      note: { ...validNote, source: "manual" },
    })
    expect(result.success).toBe(true)
  })
})

describe("notesListResponseSchema", () => {
  it("空配列でも有効", () => {
    const result = notesListResponseSchema.safeParse({ notes: [] })
    expect(result.success).toBe(true)
  })
})

describe("noteListItemSchema", () => {
  it("topicNameとsubjectNameを含むデータをパースできる", () => {
    const result = noteListItemSchema.safeParse({
      ...validNote,
      source: "chat",
      topicName: "論点名",
      subjectName: "科目名",
    })
    expect(result.success).toBe(true)
  })
})

describe("notesFullListResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = notesFullListResponseSchema.safeParse({
      notes: [
        {
          ...validNote,
          source: "manual",
          topicName: "論点A",
          subjectName: "科目A",
        },
      ],
    })
    expect(result.success).toBe(true)
  })
})

// ===== 境界値テスト =====

describe("createManualNoteRequestSchema - 境界値", () => {
  it("userMemoがちょうど10000文字でOK（max境界）", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "a".repeat(10000),
    })
    expect(result.success).toBe(true)
  })

  it("userMemoが1文字でOK（min境界）", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "a",
    })
    expect(result.success).toBe(true)
  })

  it("keyPointsがちょうど50要素でOK（max境界）", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "memo",
      keyPoints: Array.from({ length: 50 }, (_, i) => `point-${i}`),
    })
    expect(result.success).toBe(true)
  })

  it("keyPoints各要素がちょうど1000文字でOK（max境界）", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "memo",
      keyPoints: ["a".repeat(1000), "b".repeat(1000)],
    })
    expect(result.success).toBe(true)
  })

  it("stumbledPointsがちょうど50要素でOK（max境界）", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "memo",
      stumbledPoints: Array.from({ length: 50 }, (_, i) => `stumble-${i}`),
    })
    expect(result.success).toBe(true)
  })

  it("stumbledPointsが51要素でNG（max超過）", () => {
    const result = createManualNoteRequestSchema.safeParse({
      topicId: "topic-1",
      userMemo: "memo",
      stumbledPoints: Array.from({ length: 51 }, (_, i) => `stumble-${i}`),
    })
    expect(result.success).toBe(false)
  })
})

describe("updateNoteRequestSchema - 境界値", () => {
  it("keyPointsがちょうど50要素でOK（max境界）", () => {
    const result = updateNoteRequestSchema.safeParse({
      keyPoints: Array.from({ length: 50 }, (_, i) => `point-${i}`),
    })
    expect(result.success).toBe(true)
  })

  it("keyPointsが51要素でNG（max超過）", () => {
    const result = updateNoteRequestSchema.safeParse({
      keyPoints: Array.from({ length: 51 }, (_, i) => `point-${i}`),
    })
    expect(result.success).toBe(false)
  })

  it("stumbledPointsがちょうど50要素でOK（max境界）", () => {
    const result = updateNoteRequestSchema.safeParse({
      stumbledPoints: Array.from({ length: 50 }, (_, i) => `stumble-${i}`),
    })
    expect(result.success).toBe(true)
  })

  it("stumbledPointsが51要素でNG（max超過）", () => {
    const result = updateNoteRequestSchema.safeParse({
      stumbledPoints: Array.from({ length: 51 }, (_, i) => `stumble-${i}`),
    })
    expect(result.success).toBe(false)
  })

  it("userMemoがちょうど50000文字でOK（max境界）", () => {
    const result = updateNoteRequestSchema.safeParse({
      userMemo: "a".repeat(50000),
    })
    expect(result.success).toBe(true)
  })
})
