import { useAuthStore } from "@/lib/auth"
import {
  topicGeneratorChunkSchema,
  type TopicGeneratorChunk,
} from "@cpa-study/shared/schemas"

export type TocSuggestChunk = TopicGeneratorChunk

/** 目次画像からの提案をSSEで受信する。 */
export async function* suggestToc(
  subjectId: string,
  imageIds: string[],
  signal?: AbortSignal
): AsyncIterable<TocSuggestChunk> {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const token = useAuthStore.getState().token
  const response = await fetch(
    `${apiUrl}/api/toc-import/subjects/${subjectId}/suggest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ imageIds }),
      signal,
    }
  )

  if (!response.ok || !response.body) {
    throw new Error("目次の解析に失敗しました")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split("\n\n")
      buffer = events.pop() ?? ""

      for (const event of events) {
        if (!event.startsWith("data: ")) continue

        try {
          const parsed = topicGeneratorChunkSchema.safeParse(
            JSON.parse(event.slice(6))
          )
          if (!parsed.success) {
            if (import.meta.env.DEV) {
              console.warn("不正な目次解析SSEを受信しました", parsed.error)
            }
            continue
          }

          yield parsed.data
          if (parsed.data.type === "done" || parsed.data.type === "error") return
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn("目次解析SSEのJSONを読み取れませんでした", event, error)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
