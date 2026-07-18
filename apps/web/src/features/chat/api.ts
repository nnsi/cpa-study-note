import { api, fetchWithRetry } from "@/lib/api-client"
import { parseSSEStream } from "@/lib/sse"
import {
  chatStreamChunkSchema,
  chatMessagesWrapperResponseSchema,
  correctSpeechResponseSchema,
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
  if (!res.ok) throw new Error("メッセージの取得に失敗しました")
  const data = await res.json()
  return chatMessagesWrapperResponseSchema.parse(data)
}

// 論点別セッション一覧取得
export const getSessionsByTopic = async (topicId: string) => {
  const res = await api.api.chat.topics[":topicId"].sessions.$get({
    param: { topicId },
  })
  if (!res.ok) throw new Error("セッションの取得に失敗しました")
  const data = await res.json()
  return sessionsListResponseSchema.parse(data)
}

export async function* streamMessage(
  sessionId: string,
  content: string,
  imageId?: string,
  ocrResult?: string
): AsyncIterable<StreamChunk> {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const res = await fetchWithRetry(
    `${apiUrl}/api/chat/sessions/${sessionId}/messages/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ content, imageId, ocrResult }),
    }
  )
  if (!res.ok) throw new Error("ストリーミングに失敗しました")
  yield* parseSSEStream(res, chatStreamChunkSchema, "ストリーミングに失敗しました")
}

// 新規セッション + メッセージ送信（最初のメッセージ送信時にセッション作成）
export async function* streamMessageWithNewSession(
  topicId: string,
  content: string,
  imageId?: string,
  ocrResult?: string
): AsyncIterable<StreamChunk> {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const res = await fetchWithRetry(
    `${apiUrl}/api/chat/topics/${topicId}/messages/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ content, imageId, ocrResult }),
    }
  )
  if (!res.ok) throw new Error("ストリーミングに失敗しました")
  yield* parseSSEStream(res, chatStreamChunkSchema, "ストリーミングに失敗しました")
}

export const correctSpeech = async (text: string) => {
  const res = await api.api.chat["correct-speech"].$post({
    json: { text },
  })
  if (!res.ok) throw new Error("音声テキストの修正に失敗しました")
  const data = await res.json()
  return correctSpeechResponseSchema.parse(data)
}

export const evaluateMessage = async (messageId: string) => {
  const res = await api.api.chat.messages[":messageId"].evaluate.$post({
    param: { messageId },
  })
  if (!res.ok) throw new Error("メッセージ評価に失敗しました")
  return res.json()
}
