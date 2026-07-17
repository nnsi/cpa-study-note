import { fetchWithRetry } from "@/lib/api-client"
import { parseSSEStream } from "@/lib/sse"
import { planAssistantChunkSchema, type PlanAssistantChunk } from "@cpa-study/shared/schemas"

export async function* suggestPlanItems(
  planId: string,
  prompt: string,
  signal?: AbortSignal
): AsyncIterable<PlanAssistantChunk> {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const res = await fetchWithRetry(
    `${apiUrl}/api/study-plans/${planId}/suggest`,
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
  yield* parseSSEStream(res, planAssistantChunkSchema, "提案の取得に失敗しました")
}
