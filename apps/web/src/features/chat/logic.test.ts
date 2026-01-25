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
  it("タイムゾーン変換 - フォーマットが時:分形式であること", () => {
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

  it("タイムゾーン変換 - 異なる時刻が正しく区別される", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "1",
        createdAt: "2024-01-15T00:00:00.000Z", // UTC真夜中
      }),
      createMessage({
        id: "2",
        createdAt: "2024-01-15T12:00:00.000Z", // UTC正午
      }),
    ]

    const result = formatMessagesForDisplay(messages)

    // 両方の時刻が正しい形式であることを確認
    expect(result[0].formattedTime).toMatch(/^\d{2}:\d{2}$/)
    expect(result[1].formattedTime).toMatch(/^\d{2}:\d{2}$/)
    // 2つの時刻が異なることを確認（12時間差なので必ず異なる）
    expect(result[0].formattedTime).not.toBe(result[1].formattedTime)
  })

  it("タイムゾーン変換 - 深夜境界（UTC 23:59と00:00）が正しく処理される", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "1",
        createdAt: "2024-01-14T23:59:00.000Z",
      }),
      createMessage({
        id: "2",
        createdAt: "2024-01-15T00:00:00.000Z",
      }),
    ]

    const result = formatMessagesForDisplay(messages)

    // 両方とも正しい形式
    expect(result[0].formattedTime).toMatch(/^\d{2}:\d{2}$/)
    expect(result[1].formattedTime).toMatch(/^\d{2}:\d{2}$/)

    // 1分差があることを確認（タイムゾーンに依存しない検証）
    const time0 = result[0].formattedTime.split(":").map(Number)
    const time1 = result[1].formattedTime.split(":").map(Number)
    const minutes0 = time0[0] * 60 + time0[1]
    const minutes1 = time1[0] * 60 + time1[1]
    // 1分差または23:59分差（日付をまたぐ場合）
    const diff = Math.abs(minutes1 - minutes0)
    expect([1, 1439]).toContain(diff)
  })

  it("タイムゾーン変換 - toLocaleTimeStringでja-JP形式の文字列を生成", () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: "1",
        createdAt: "2024-01-15T15:45:00.000Z",
      }),
    ]

    const result = formatMessagesForDisplay(messages)

    // 時:分が2桁ずつであることを確認（ja-JPの特徴）
    const [hour, minute] = result[0].formattedTime.split(":")
    expect(hour).toMatch(/^\d{2}$/)
    expect(minute).toMatch(/^\d{2}$/)
    // 分が45であることを確認（タイムゾーンに関係なく分は変わらない）
    expect(minute).toBe("45")
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
