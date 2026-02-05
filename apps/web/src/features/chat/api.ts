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

export async function* streamMessage(
  sessionId: string,
  content: string,
  imageId?: string,
  ocrResult?: string
): AsyncIterable<StreamChunk> {
  // Hono RPCではなくfetchを直接使用（SSEストリーミング対応）
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const token = useAuthStore.getState().token
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
    }
  )

  if (!res.ok || !res.body) throw new Error("Stream failed")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const chunk: StreamChunk = JSON.parse(line.slice(6))
          yield chunk
          if (chunk.type === "done" || chunk.type === "error") return
        } catch (e) {
          // 不正なJSONチャンクはスキップ（ネットワーク分断等で発生しうる）
          if (import.meta.env.DEV) {
            console.warn("SSE parse error:", line, e)
          }
        }
      }
    }
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
    }
  )

  if (!res.ok || !res.body) throw new Error("Stream failed")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const chunk: StreamChunk = JSON.parse(line.slice(6))
          yield chunk
          if (chunk.type === "done" || chunk.type === "error") return
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn("SSE parse error:", line, e)
          }
        }
      }
    }
  }
}

export const evaluateMessage = async (messageId: string) => {
  const res = await api.api.chat.messages[":messageId"].evaluate.$post({
    param: { messageId },
  })
  if (!res.ok) throw new Error("Failed to evaluate message")
  return res.json()
}
