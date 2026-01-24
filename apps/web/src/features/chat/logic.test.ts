import { describe, it, expect } from "vitest"
import {
  filterMessagesByRole,
  countQuestionQuality,
  formatMessagesForDisplay,
  type ChatMessage,
} from "./logic"

const createMessage = (
  overrides: Partial<ChatMessage> = {}
): ChatMessage => ({
  id: "msg-1",
  sessionId: "session-1",
  role: "user",
  content: "test message",
  imageId: null,
  ocrResult: null,
  questionQuality: null,
  createdAt: "2024-01-15T10:30:00.000Z",
  ...overrides,
})

describe("filterMessagesByRole", () => {
  it("userのみフィルタ", () => {
    const messages: ChatMessage[] = [
      createMessage({ id: "1", role: "user" }),
      createMessage({ id: "2", role: "assistant" }),
      createMessage({ id: "3", role: "user" }),
      createMessage({ id: "4", role: "assistant" }),
    ]

    const result = filterMessagesByRole(messages, "user")

    expect(result).toHaveLength(2)
    expect(result.every((m) => m.role === "user")).toBe(true)
    expect(result.map((m) => m.id)).toEqual(["1", "3"])
  })

  it("assistantのみフィルタ", () => {
    const messages: ChatMessage[] = [
      createMessage({ id: "1", role: "user" }),
      createMessage({ id: "2", role: "assistant" }),
      createMessage({ id: "3", role: "user" }),
      createMessage({ id: "4", role: "assistant" }),
    ]

    const result = filterMessagesByRole(messages, "assistant")

    expect(result).toHaveLength(2)
    expect(result.every((m) => m.role === "assistant")).toBe(true)
    expect(result.map((m) => m.id)).toEqual(["2", "4"])
  })

  it("該当するメッセージがない場合は空配列を返す", () => {
    const messages: ChatMessage[] = [
      createMessage({ id: "1", role: "user" }),
      createMessage({ id: "2", role: "user" }),
    ]

    const result = filterMessagesByRole(messages, "assistant")

    expect(result).toEqual([])
  })
})

describe("countQuestionQuality", () => {
  it("good/surfaceカウント", () => {
    const messages: ChatMessage[] = [
      createMessage({ id: "1", role: "user", questionQuality: "good" }),
      createMessage({ id: "2", role: "user", questionQuality: "surface" }),
      createMessage({ id: "3", role: "user", questionQuality: "good" }),
      createMessage({ id: "4", role: "user", questionQuality: null }),
      createMessage({ id: "5", role: "assistant" }), // assistantはカウント対象外
    ]

    const result = countQuestionQuality(messages)

    expect(result).toEqual({
      total: 4,
      good: 2,
      surface: 1,
    })
  })

  it("空配列の場合は全て0", () => {
    const result = countQuestionQuality([])

    expect(result).toEqual({
      total: 0,
      good: 0,
      surface: 0,
    })
  })

  it("質問評価がないメッセージのみの場合", () => {
    const messages: ChatMessage[] = [
      createMessage({ id: "1", role: "user", questionQuality: null }),
      createMessage({ id: "2", role: "user", questionQuality: null }),
    ]

    const result = countQuestionQuality(messages)

    expect(result).toEqual({
      total: 2,
      good: 0,
      surface: 0,
    })
  })
})

describe("formatMessagesForDisplay", () => {
  it("タイムゾーン変換", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "1",
        role: "user",
        createdAt: "2024-01-15T10:30:00.000Z",
      }),
      createMessage({
        id: "2",
        role: "assistant",
        createdAt: "2024-01-15T10:31:00.000Z",
      }),
    ]

    const result = formatMessagesForDisplay(messages)

    expect(result).toHaveLength(2)
    // formattedTimeが時:分形式になっていることを確認
    expect(result[0].formattedTime).toMatch(/^\d{2}:\d{2}$/)
    expect(result[1].formattedTime).toMatch(/^\d{2}:\d{2}$/)
    // isUserフラグ
    expect(result[0].isUser).toBe(true)
    expect(result[1].isUser).toBe(false)
  })

  it("空配列", () => {
    const result = formatMessagesForDisplay([])

    expect(result).toEqual([])
  })

  it("元のメッセージのプロパティを保持する", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "1",
        content: "Hello",
        imageId: "img-1",
        ocrResult: "OCR text",
      }),
    ]

    const result = formatMessagesForDisplay(messages)

    expect(result[0]).toMatchObject({
      id: "1",
      content: "Hello",
      imageId: "img-1",
      ocrResult: "OCR text",
    })
  })
})
