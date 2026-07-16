import { fetchWithRetry } from "@/lib/api-client"
import { parseSSEStream } from "@/lib/sse"
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
  const response = await fetchWithRetry(
    `${apiUrl}/api/toc-import/subjects/${subjectId}/suggest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ imageIds }),
      signal,
    }
  )

  if (!response.ok) {
    throw new Error("目次の解析に失敗しました")
  }

  yield* parseSSEStream(response, topicGeneratorChunkSchema, "目次の解析に失敗しました")
}
