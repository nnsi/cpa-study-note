import { api } from "@/lib/api-client"
import { useAuthStore } from "@/lib/auth"
import {
  chatMessagesWrapperResponseSchema,
  sessionsListResponseSchema,
  type ChatMessage,
  type ChatStreamChunk,
} from "@cpa-study/shared/schemas"

export type { ChatMessage }

// Re-export ChatStreamChunk as StreamChunk for backward compatibility
export type StreamChunk = ChatStreamChunk

export const getMessages = async (sessionId: string): Promise<{ messages: ChatMessage[] }> => {
  const res = await api.api.chat.sessions[":sessionId"].messages.$get({
    param: { sessionId },
  })
  if (!res.ok) throw new Error("Failed to fetch messages")
  const data = await res.json()
  return chatMessagesWrapperResponseSchema.parse(data)
}

// 論点別セッション一覧取得
export const getSessionsByTopic = async (topicId: string) => {
  const res = await api.api.chat.topics[":topicId"].sessions.$get({
    param: { topicId },
  })
  if (!res.ok) throw new Error("Failed to fetch sessions")
  const data = await res.json()
  return sessionsListResponseSchema.parse(data)
}

// ストリーム全体のタイムアウト（秒）
const STREAM_TIMEOUT_MS = 60_000
// チャンク間の最大待機時間（秒）- これを超えるとストール検知
const STALL_TIMEOUT_MS = 30_000

async function* readSSEStream(
  res: Response,
  controller: AbortController
): AsyncIterable<StreamChunk> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let receivedTerminal = false
  let stallTimer: ReturnType<typeof setTimeout> | null = null

  const resetStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer)
    stallTimer = setTimeout(() => {
      controller.abort()
    }, STALL_TIMEOUT_MS)
  }

  try {
    resetStallTimer()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      resetStallTimer()
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6))
            yield chunk
            if (chunk.type === "done" || chunk.type === "error") {
              receivedTerminal = true
              return
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.warn("SSE parse error:", line, e)
            }
          }
        }
      }
    }

    // readerが終了したのにdone/errorチャンクを受信していない → 異常終了
    if (!receivedTerminal) {
      yield { type: "error", error: "接続が中断されました。再度お試しください。" }
    }
  } catch (e) {
    if (controller.signal.aborted) {
      yield { type: "error", error: "応答がタイムアウトしました。再度お試しください。" }
    } else {
      throw e
    }
  } finally {
    if (stallTimer) clearTimeout(stallTimer)
    reader.cancel().catch(() => {})
  }
}

export async function* streamMessage(
  sessionId: string,
  content: string,
  imageId?: string,
  ocrResult?: string
): AsyncIterable<StreamChunk> {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const token = useAuthStore.getState().token
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)

  try {
    const res = await fetch(
      `${apiUrl}/api/chat/sessions/${sessionId}/messages/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ content, imageId, ocrResult }),
        signal: controller.signal,
      }
    )

    if (!res.ok || !res.body) throw new Error("Stream failed")

    yield* readSSEStream(res, controller)
  } catch (e) {
    if (controller.signal.aborted) {
      yield { type: "error", error: "応答がタイムアウトしました。再度お試しください。" }
    } else {
      throw e
    }
  } finally {
    clearTimeout(timeout)
  }
}

// 新規セッション + メッセージ送信（最初のメッセージ送信時にセッション作成）
export async function* streamMessageWithNewSession(
  topicId: string,
  content: string,
  imageId?: string,
  ocrResult?: string
): AsyncIterable<StreamChunk> {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const token = useAuthStore.getState().token
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)

  try {
    const res = await fetch(
      `${apiUrl}/api/chat/topics/${topicId}/messages/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ content, imageId, ocrResult }),
        signal: controller.signal,
      }
    )

    if (!res.ok || !res.body) throw new Error("Stream failed")

    yield* readSSEStream(res, controller)
  } catch (e) {
    if (controller.signal.aborted) {
      yield { type: "error", error: "応答がタイムアウトしました。再度お試しください。" }
    } else {
      throw e
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const evaluateMessage = async (messageId: string) => {
  const res = await api.api.chat.messages[":messageId"].evaluate.$post({
    param: { messageId },
  })
  if (!res.ok) throw new Error("Failed to evaluate message")
  return res.json()
}
