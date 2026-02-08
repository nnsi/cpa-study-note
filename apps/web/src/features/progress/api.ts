import { api } from "@/lib/api-client"
import {
  userProgressListResponseSchema,
  subjectsListResponseSchema,
  subjectProgressStatsListResponseSchema,
} from "@cpa-study/shared/schemas"

export const getMyProgress = async () => {
  const res = await api.api.learning.progress.$get()
  if (!res.ok) throw new Error("進捗の取得に失敗しました")
  const data = await res.json()
  return userProgressListResponseSchema.parse(data)
}

export const getSubjects = async (studyDomainId?: string) => {
  const res = await api.api.subjects.$get({
    query: studyDomainId ? { studyDomainId } : {},
  })
  if (!res.ok) throw new Error("科目の取得に失敗しました")
  const data = await res.json()
  return subjectsListResponseSchema.parse(data)
}

export const getSubjectProgressStats = async () => {
  const res = await api.api.learning.subjects["progress-stats"].$get()
  if (!res.ok) throw new Error("科目別進捗の取得に失敗しました")
  const data = await res.json()
  return subjectProgressStatsListResponseSchema.parse(data)
}
