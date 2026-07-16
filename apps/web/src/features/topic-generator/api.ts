import { fetchWithRetry } from "@/lib/api-client"
import { parseSSEStream } from "@/lib/sse"
import { topicGeneratorChunkSchema, type TopicGeneratorChunk } from "@cpa-study/shared/schemas"

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
  const res = await fetchWithRetry(
    `${apiUrl}/api/topic-generator/subjects/${subjectId}/suggest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ prompt }),
      signal,
    }
  )

  if (!res.ok) throw new Error("提案の取得に失敗しました")
  yield* parseSSEStream(res, topicGeneratorChunkSchema, "提案の取得に失敗しました")
}
