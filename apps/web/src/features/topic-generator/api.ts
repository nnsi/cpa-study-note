import { useAuthStore } from "@/lib/auth"
import type { TopicGeneratorChunk } from "@cpa-study/shared/schemas"

export type SuggestChunk = TopicGeneratorChunk

/**
 * SSEストリーミングで論点提案を受信する async generator。
 * chat/api.ts の streamMessage と同じパターン。
 * signal を渡すことでモーダルclose時にfetchを中断できる。
 */
export async function* suggestTopics(
  subjectId: string,
  prompt: string,
  signal?: AbortSignal
): AsyncIterable<SuggestChunk> {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const token = useAuthStore.getState().token
  const res = await fetch(
    `${apiUrl}/api/topic-generator/subjects/${subjectId}/suggest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ prompt }),
      signal,
    }
  )

  if (!res.ok || !res.body) throw new Error("提案の取得に失敗しました")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const chunk: SuggestChunk = JSON.parse(line.slice(6))
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
  } finally {
    reader.releaseLock()
  }
}
