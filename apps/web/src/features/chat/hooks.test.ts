import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactNode } from "react"
import { useSendMessage, useChatInput } from "./hooks"

// APIモジュールをモック
vi.mock("./api", () => ({
  getMessages: vi.fn(),
  streamMessage: vi.fn(),
  streamMessageWithNewSession: vi.fn(),
  evaluateMessage: vi.fn(),
}))

import * as api from "./api"

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const createWrapper = () => {
  const queryClient = createTestQueryClient()
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// AsyncIterableを作成するヘルパー
async function* createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item
  }
}

describe("useSendMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("送信開始→ストリーミング→完了", async () => {
    const chunks = [
      { type: "text" as const, content: "Hello" },
      { type: "text" as const, content: " World" },
      { type: "done" as const, messageId: "msg-1" },
    ]
    vi.mocked(api.streamMessage).mockReturnValue(createAsyncIterable(chunks))
    vi.mocked(api.evaluateMessage).mockResolvedValue({ quality: { quality: "good", reason: "Good question" } })

    const { result } = renderHook(
      () =>
        useSendMessage({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    // 初期状態
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.streamingText).toBe("")
    expect(result.current.error).toBeNull()

    // メッセージ送信
    await act(async () => {
      await result.current.sendMessage("test message")
    })

    // 完了後の状態
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.streamingText).toBe("")
    expect(result.current.error).toBeNull()

    // APIが呼ばれたことを確認
    expect(api.streamMessage).toHaveBeenCalledWith(
      "session-1",
      "test message",
      undefined,
      undefined
    )
  })

  it("エラー時の状態", async () => {
    const chunks = [{ type: "error" as const, error: "Something went wrong" }]
    vi.mocked(api.streamMessage).mockReturnValue(createAsyncIterable(chunks))

    const { result } = renderHook(
      () =>
        useSendMessage({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    await act(async () => {
      await result.current.sendMessage("test message")
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe("Something went wrong")
    expect(result.current.isStreaming).toBe(false)
  })

  it("新規セッション作成時にonSessionCreatedが呼ばれる", async () => {
    const onSessionCreated = vi.fn()
    const chunks = [
      { type: "session_created" as const, sessionId: "new-session-id" },
      { type: "text" as const, content: "Hello" },
      { type: "done" as const, messageId: "msg-1" },
    ]
    vi.mocked(api.streamMessageWithNewSession).mockReturnValue(
      createAsyncIterable(chunks)
    )
    vi.mocked(api.evaluateMessage).mockResolvedValue({ quality: { quality: "good", reason: "Good question" } })

    const { result } = renderHook(
      () =>
        useSendMessage({
          sessionId: null, // 新規セッション
          topicId: "topic-1",
          onSessionCreated,
        }),
      { wrapper: createWrapper() }
    )

    await act(async () => {
      await result.current.sendMessage("test message")
    })

    expect(onSessionCreated).toHaveBeenCalledWith("new-session-id")
    expect(api.streamMessageWithNewSession).toHaveBeenCalledWith(
      "topic-1",
      "test message",
      undefined,
      undefined
    )
  })

  it("例外が発生した場合のエラー処理", async () => {
    vi.mocked(api.streamMessage).mockImplementation(async function* () {
      throw new Error("Network error")
    })

    const { result } = renderHook(
      () =>
        useSendMessage({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    await act(async () => {
      await result.current.sendMessage("test message")
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe("Network error")
    expect(result.current.isStreaming).toBe(false)
  })

  it("pendingUserMessageが送信中に設定される", async () => {
    let resolvePromise: () => void
    const waitPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    vi.mocked(api.streamMessage).mockImplementation(async function* () {
      await waitPromise
      yield { type: "done" as const, messageId: "msg-1" }
    })

    const { result } = renderHook(
      () =>
        useSendMessage({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    // 送信開始（完了を待たない）
    let sendPromise: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage("test message", "img-1")
    })

    // ストリーミング中の状態を確認
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true)
      expect(result.current.pendingUserMessage).toEqual({
        content: "test message",
        imageId: "img-1",
      })
    })

    // 完了させる
    await act(async () => {
      resolvePromise!()
      await sendPromise!
    })

    expect(result.current.pendingUserMessage).toBeNull()
  })
})

describe("useChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("入力値管理", async () => {
    const chunks = [{ type: "done" as const, messageId: "msg-1" }]
    vi.mocked(api.streamMessage).mockReturnValue(createAsyncIterable(chunks))

    const { result } = renderHook(
      () =>
        useChatInput({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    // 初期状態
    expect(result.current.content).toBe("")

    // 入力値変更
    act(() => {
      result.current.handleContentChange("Hello World")
    })

    expect(result.current.content).toBe("Hello World")
  })

  it("画像添付", async () => {
    const { result } = renderHook(
      () =>
        useChatInput({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    // 初期状態
    expect(result.current.imageId).toBeNull()
    expect(result.current.ocrText).toBeNull()

    // 画像選択
    act(() => {
      result.current.handleImageSelect("img-123", "OCR extracted text")
    })

    expect(result.current.imageId).toBe("img-123")
    expect(result.current.ocrText).toBe("OCR extracted text")

    // 画像クリア
    act(() => {
      result.current.handleImageClear()
    })

    expect(result.current.imageId).toBeNull()
    expect(result.current.ocrText).toBeNull()
  })

  it("送信後に入力がクリアされる", async () => {
    const chunks = [{ type: "done" as const, messageId: "msg-1" }]
    vi.mocked(api.streamMessage).mockReturnValue(createAsyncIterable(chunks))

    const { result } = renderHook(
      () =>
        useChatInput({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    // 入力値を設定
    act(() => {
      result.current.handleContentChange("Test message")
      result.current.handleImageSelect("img-1", "OCR text")
    })

    expect(result.current.content).toBe("Test message")
    expect(result.current.imageId).toBe("img-1")

    // 送信
    await act(async () => {
      await result.current.handleSubmit()
    })

    // 入力がクリアされている
    expect(result.current.content).toBe("")
    expect(result.current.imageId).toBeNull()
    expect(result.current.ocrText).toBeNull()
  })

  it("空白のみの入力は送信されない", async () => {
    vi.mocked(api.streamMessage).mockReturnValue(
      createAsyncIterable([{ type: "done" as const, messageId: "msg-1" }])
    )

    const { result } = renderHook(
      () =>
        useChatInput({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    act(() => {
      result.current.handleContentChange("   ")
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    // APIが呼ばれていない
    expect(api.streamMessage).not.toHaveBeenCalled()
  })

  it("ストリーミング中は送信できない", async () => {
    let resolvePromise: () => void
    const waitPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    vi.mocked(api.streamMessage).mockImplementation(async function* () {
      await waitPromise
      yield { type: "done" as const, messageId: "msg-1" }
    })

    const { result } = renderHook(
      () =>
        useChatInput({
          sessionId: "session-1",
          topicId: "topic-1",
        }),
      { wrapper: createWrapper() }
    )

    // 最初のメッセージを入力・送信開始
    act(() => {
      result.current.handleContentChange("First message")
    })

    let firstSend: Promise<void>
    act(() => {
      firstSend = result.current.handleSubmit()
    })

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true)
    })

    // 2回目の送信を試みる
    act(() => {
      result.current.handleContentChange("Second message")
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    // streamMessageは1回だけ呼ばれる
    expect(api.streamMessage).toHaveBeenCalledTimes(1)

    // 完了させる
    await act(async () => {
      resolvePromise!()
      await firstSend!
    })
  })
})
