import { api } from "@/lib/api-client"

export type TopicFilterParams = {
  minSessionCount?: number
  daysSinceLastChat?: number
  understood?: boolean
  hasPostCheckChat?: boolean
  minGoodQuestionCount?: number
}

export type FilteredTopic = {
  id: string
  name: string
  categoryId: string
  subjectId: string
  subjectName: string
  sessionCount: number
  lastChatAt: string | null
  understood: boolean
  goodQuestionCount: number
}

export const filterTopics = async (
  params: TopicFilterParams
): Promise<FilteredTopic[]> => {
  const query: Record<string, string> = {}

  if (params.minSessionCount !== undefined) {
    query.minSessionCount = String(params.minSessionCount)
  }
  if (params.daysSinceLastChat !== undefined) {
    query.daysSinceLastChat = String(params.daysSinceLastChat)
  }
  if (params.understood !== undefined) {
    query.understood = String(params.understood)
  }
  if (params.hasPostCheckChat !== undefined) {
    query.hasPostCheckChat = String(params.hasPostCheckChat)
  }
  if (params.minGoodQuestionCount !== undefined) {
    query.minGoodQuestionCount = String(params.minGoodQuestionCount)
  }

  const res = await api.api.subjects.filter.$get({ query })
  if (!res.ok) throw new Error("Failed to filter topics")
  const data = await res.json()
  return data.topics
}
