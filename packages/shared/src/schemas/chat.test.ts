import { describe, it, expect } from "vitest"
import {
  messageRoleSchema,
  questionQualitySchema,
  chatSessionSchema,
  chatMessageSchema,
  createSessionRequestSchema,
  sendMessageRequestSchema,
  chatStreamChunkSchema,
  chatMessagesWrapperResponseSchema,
  goodQuestionResponseSchema,
  goodQuestionsListResponseSchema,
  correctSpeechRequestSchema,
  correctSpeechResponseSchema,
  sessionWithStatsSchema,
  sessionsListResponseSchema,
} from "./chat"

const validSession = {
  id: "session-1",
  userId: "user-1",
  topicId: "topic-1",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
}

const validMessage = {
  id: "msg-1",
  sessionId: "session-1",
  role: "user" as const,
  content: "テスト質問",
  imageId: null,
  ocrResult: null,
  questionQuality: null,
  createdAt: "2025-01-01T00:00:00Z",
}

describe("messageRoleSchema", () => {
  it("有効な値をパースできる", () => {
    expect(messageRoleSchema.safeParse("user").success).toBe(true)
    expect(messageRoleSchema.safeParse("assistant").success).toBe(true)
    expect(messageRoleSchema.safeParse("system").success).toBe(true)
  })

  it("無効な値でエラー", () => {
    expect(messageRoleSchema.safeParse("admin").success).toBe(false)
  })
})

describe("questionQualitySchema", () => {
  it("good/surface/nullをパースできる", () => {
    expect(questionQualitySchema.safeParse("good").success).toBe(true)
    expect(questionQualitySchema.safeParse("surface").success).toBe(true)
    expect(questionQualitySchema.safeParse(null).success).toBe(true)
  })

  it("無効な値でエラー", () => {
    expect(questionQualitySchema.safeParse("bad").success).toBe(false)
  })
})

describe("chatSessionSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = chatSessionSchema.safeParse(validSession)
    expect(result.success).toBe(true)
  })

  it("必須フィールド欠落でエラー", () => {
    const result = chatSessionSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("chatMessageSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = chatMessageSchema.safeParse(validMessage)
    expect(result.success).toBe(true)
  })

  it("roleが不正でエラー", () => {
    const result = chatMessageSchema.safeParse({ ...validMessage, role: "invalid" })
    expect(result.success).toBe(false)
  })

  it("imageIdとocrResultがnullでもパースできる", () => {
    const result = chatMessageSchema.safeParse(validMessage)
    expect(result.success).toBe(true)
  })
})

describe("createSessionRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = createSessionRequestSchema.safeParse({ topicId: "topic-1" })
    expect(result.success).toBe(true)
  })

  it("topicId欠落でエラー", () => {
    const result = createSessionRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("sendMessageRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = sendMessageRequestSchema.safeParse({ content: "質問です" })
    expect(result.success).toBe(true)
  })

  it("空文字でエラー", () => {
    const result = sendMessageRequestSchema.safeParse({ content: "" })
    expect(result.success).toBe(false)
  })

  it("10000文字超でエラー", () => {
    const result = sendMessageRequestSchema.safeParse({
      content: "a".repeat(10001),
    })
    expect(result.success).toBe(false)
  })

  it("imageIdとocrResultはオプション", () => {
    const result = sendMessageRequestSchema.safeParse({
      content: "質問",
      imageId: "img-1",
      ocrResult: "OCRテキスト",
    })
    expect(result.success).toBe(true)
  })

  it("ocrResultが50000文字超でエラー", () => {
    const result = sendMessageRequestSchema.safeParse({
      content: "質問",
      ocrResult: "a".repeat(50001),
    })
    expect(result.success).toBe(false)
  })
})

describe("chatStreamChunkSchema", () => {
  it("textチャンクをパースできる", () => {
    const result = chatStreamChunkSchema.safeParse({ type: "text", content: "回答" })
    expect(result.success).toBe(true)
  })

  it("doneチャンクをパースできる", () => {
    const result = chatStreamChunkSchema.safeParse({ type: "done" })
    expect(result.success).toBe(true)
  })

  it("doneチャンクにmessageIdを含められる", () => {
    const result = chatStreamChunkSchema.safeParse({ type: "done", messageId: "msg-1" })
    expect(result.success).toBe(true)
  })

  it("errorチャンクをパースできる", () => {
    const result = chatStreamChunkSchema.safeParse({ type: "error", error: "エラー" })
    expect(result.success).toBe(true)
  })

  it("session_createdチャンクをパースできる", () => {
    const result = chatStreamChunkSchema.safeParse({
      type: "session_created",
      sessionId: "session-1",
    })
    expect(result.success).toBe(true)
  })

  it("無効なtypeでエラー", () => {
    const result = chatStreamChunkSchema.safeParse({ type: "unknown" })
    expect(result.success).toBe(false)
  })
})

describe("chatMessagesWrapperResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = chatMessagesWrapperResponseSchema.safeParse({
      messages: [validMessage],
    })
    expect(result.success).toBe(true)
  })

  it("空配列でも有効", () => {
    const result = chatMessagesWrapperResponseSchema.safeParse({ messages: [] })
    expect(result.success).toBe(true)
  })
})

describe("goodQuestionResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = goodQuestionResponseSchema.safeParse({
      id: "q-1",
      sessionId: "session-1",
      content: "良い質問",
      createdAt: "2025-01-01T00:00:00Z",
    })
    expect(result.success).toBe(true)
  })
})

describe("goodQuestionsListResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = goodQuestionsListResponseSchema.safeParse({ questions: [] })
    expect(result.success).toBe(true)
  })
})

describe("correctSpeechRequestSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = correctSpeechRequestSchema.safeParse({ text: "音声テキスト" })
    expect(result.success).toBe(true)
  })

  it("空文字でエラー", () => {
    const result = correctSpeechRequestSchema.safeParse({ text: "" })
    expect(result.success).toBe(false)
  })

  it("2000文字超でエラー", () => {
    const result = correctSpeechRequestSchema.safeParse({
      text: "a".repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe("correctSpeechResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = correctSpeechResponseSchema.safeParse({
      correctedText: "補正テキスト",
    })
    expect(result.success).toBe(true)
  })
})

describe("sessionWithStatsSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = sessionWithStatsSchema.safeParse({
      ...validSession,
      messageCount: 5,
      goodCount: 2,
      surfaceCount: 1,
      firstMessagePreview: "最初のメッセージ",
    })
    expect(result.success).toBe(true)
  })

  it("firstMessagePreviewがnullでも有効", () => {
    const result = sessionWithStatsSchema.safeParse({
      ...validSession,
      messageCount: 0,
      goodCount: 0,
      surfaceCount: 0,
      firstMessagePreview: null,
    })
    expect(result.success).toBe(true)
  })
})

describe("sessionsListResponseSchema", () => {
  it("有効なデータをパースできる", () => {
    const result = sessionsListResponseSchema.safeParse({ sessions: [] })
    expect(result.success).toBe(true)
  })
})

// ===== 境界値テスト =====

describe("sendMessageRequestSchema - 境界値", () => {
  it("contentがちょうど10000文字でOK（max境界）", () => {
    const result = sendMessageRequestSchema.safeParse({
      content: "a".repeat(10000),
    })
    expect(result.success).toBe(true)
  })

  it("contentが1文字でOK（min境界）", () => {
    const result = sendMessageRequestSchema.safeParse({
      content: "a",
    })
    expect(result.success).toBe(true)
  })

  it("ocrResultがちょうど50000文字でOK（max境界）", () => {
    const result = sendMessageRequestSchema.safeParse({
      content: "質問",
      ocrResult: "a".repeat(50000),
    })
    expect(result.success).toBe(true)
  })
})

describe("correctSpeechRequestSchema - 境界値", () => {
  it("textがちょうど2000文字でOK（max境界）", () => {
    const result = correctSpeechRequestSchema.safeParse({
      text: "a".repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it("textが1文字でOK（min境界）", () => {
    const result = correctSpeechRequestSchema.safeParse({
      text: "a",
    })
    expect(result.success).toBe(true)
  })
})
