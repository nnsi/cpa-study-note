import { api } from "@/lib/api-client"

export type StreamChunk =
  | { type: "text"; content: string }
  | { type: "done"; messageId: string }
  | { type: "error"; error: string }

export const getMessages = async (sessionId: string) => {
  const res = await api.api.chat.sessions[":sessionId"].messages.$get({
    param: { sessionId },
  })
  if (!res.ok) throw new Error("Failed to fetch messages")
  return res.json()
}

export async function* streamMessage(
  sessionId: string,
  content: string,
  imageId?: string,
  ocrResult?: string
): AsyncIterable<StreamChunk> {
  const res = await api.api.chat.sessions[":sessionId"].messages.stream.$post({
    param: { sessionId },
    json: { content, imageId, ocrResult },
  })

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
        } catch {
          // パースエラーは無視
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
