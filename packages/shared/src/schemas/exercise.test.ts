import { describe, it, expect } from "vitest"
import {
  confidenceSchema,
  suggestedTopicSchema,
  exerciseSchema,
  analyzeExerciseRequestSchema,
  confirmExerciseRequestSchema,
  analyzeExerciseResponseSchema,
  confirmExerciseResponseSchema,
  exerciseWithImageSchema,
  topicExercisesResponseSchema,
} from "./exercise"

describe("confidenceSchema", () => {
  it("有効な値をパースできる", () => {
    expect(confidenceSchema.safeParse("high").success).toBe(true)
    expect(confidenceSchema.safeParse("medium").success).toBe(true)
    expect(confidenceSchema.safeParse("low").success).toBe(true)
  })

  it("無効な値でエラー", () => {
    expect(confidenceSchema.safeParse("very_high").success).toBe(false)
  })
})

describe("suggestedTopicSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = suggestedTopicSchema.safeParse({
      topicId: "topic-1",
      topicName: "論点名",
      subjectName: "科目名",
      confidence: "high",
      reason: "理由テキスト",
    })
    expect(result.success).toBe(true)
  })
})

describe("exerciseSchema", () => {
  const validExercise = {
    id: "ex-1",
    userId: "user-1",
    imageId: "img-1",
    topicId: "topic-1",
    suggestedTopicIds: ["topic-1", "topic-2"],
    markedAsUnderstood: false,
    createdAt: "2025-01-01T00:00:00Z",
    confirmedAt: null,
  }

  it("有効なデータをパースできる", () => {
    const result = exerciseSchema.safeParse(validExercise)
    expect(result.success).toBe(true)
  })

  it("topicIdがnullでも有効", () => {
    const result = exerciseSchema.safeParse({ ...validExercise, topicId: null })
    expect(result.success).toBe(true)
  })

  it("suggestedTopicIdsがnullでも有効", () => {
    const result = exerciseSchema.safeParse({
      ...validExercise,
      suggestedTopicIds: null,
    })
    expect(result.success).toBe(true)
  })

  it("confirmedAtがnullでも有効", () => {
    const result = exerciseSchema.safeParse(validExercise)
    expect(result.success).toBe(true)
  })
})

describe("analyzeExerciseRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = analyzeExerciseRequestSchema.safeParse({
      filename: "test.jpg",
      mimeType: "image/jpeg",
    })
    expect(result.success).toBe(true)
  })

  it("filenameが空文字でエラー", () => {
    const result = analyzeExerciseRequestSchema.safeParse({
      filename: "",
      mimeType: "image/jpeg",
    })
    expect(result.success).toBe(false)
  })

  it("不正なmimeTypeでエラー", () => {
    const result = analyzeExerciseRequestSchema.safeParse({
      filename: "test.pdf",
      mimeType: "application/pdf",
    })
    expect(result.success).toBe(false)
  })

  it("対応するmimeType全てパースできる", () => {
    for (const mime of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
      const result = analyzeExerciseRequestSchema.safeParse({
        filename: "test.img",
        mimeType: mime,
      })
      expect(result.success).toBe(true)
    }
  })
})

describe("confirmExerciseRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = confirmExerciseRequestSchema.safeParse({
      topicId: "topic-1",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.markAsUnderstood).toBe(false)
    }
  })

  it("topicIdが空文字でエラー", () => {
    const result = confirmExerciseRequestSchema.safeParse({ topicId: "" })
    expect(result.success).toBe(false)
  })

  it("markAsUnderstoodを指定できる", () => {
    const result = confirmExerciseRequestSchema.safeParse({
      topicId: "topic-1",
      markAsUnderstood: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.markAsUnderstood).toBe(true)
    }
  })
})

describe("analyzeExerciseResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = analyzeExerciseResponseSchema.safeParse({
      exerciseId: "ex-1",
      imageId: "img-1",
      ocrText: "OCRテキスト",
      suggestedTopics: [
        {
          topicId: "topic-1",
          topicName: "論点名",
          subjectName: "科目名",
          confidence: "medium",
          reason: "理由",
        },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe("confirmExerciseResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = confirmExerciseResponseSchema.safeParse({
      exerciseId: "ex-1",
      topicId: "topic-1",
      topicChecked: true,
      createdAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })
})

describe("exerciseWithImageSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = exerciseWithImageSchema.safeParse({
      exerciseId: "ex-1",
      imageId: "img-1",
      ocrText: null,
      createdAt: "2025-01-01T00:00:00Z",
      markedAsUnderstood: false,
    })
    expect(result.success).toBe(true)
  })
})

describe("topicExercisesResponseSchema", () => {
  it("空配列でも有効", () => {
    const result = topicExercisesResponseSchema.safeParse({ exercises: [] })
    expect(result.success).toBe(true)
  })
})

// ===== 境界値テスト =====

describe("confirmExerciseRequestSchema - 境界値", () => {
  it("topicIdが1文字でOK（min(1)境界）", () => {
    const result = confirmExerciseRequestSchema.safeParse({
      topicId: "a",
    })
    expect(result.success).toBe(true)
  })
})
