import { api } from "@/lib/api-client"
import {
  userProgressListResponseSchema,
  subjectsListResponseSchema,
  subjectProgressStatsListResponseSchema,
} from "@cpa-study/shared/schemas"

export const getMyProgress = async () => {
  const res = await api.api.learning.progress.$get()
  if (!res.ok) throw new Error("Failed to fetch progress")
  const data = await res.json()
  return userProgressListResponseSchema.parse(data)
}

export const getSubjects = async (studyDomainId?: string) => {
  const res = await api.api.subjects.$get({
    query: studyDomainId ? { studyDomainId } : {},
  })
  if (!res.ok) throw new Error("Failed to fetch subjects")
  const data = await res.json()
  return subjectsListResponseSchema.parse(data)
}

export const getSubjectProgressStats = async () => {
  const res = await api.api.learning.subjects["progress-stats"].$get()
  if (!res.ok) throw new Error("Failed to fetch subject progress")
  const data = await res.json()
  return subjectProgressStatsListResponseSchema.parse(data)
}
