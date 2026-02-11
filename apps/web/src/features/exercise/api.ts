import { api, fetchWithRetry, extractErrorMessage } from "@/lib/api-client"
import {
  analyzeExerciseResponseSchema,
  confirmExerciseResponseSchema,
  topicExercisesResponseSchema,
  type AnalyzeExerciseResponse,
  type ConfirmExerciseResponse,
  type TopicExercisesResponse,
} from "@cpa-study/shared/schemas"

export const analyzeExercise = async (file: File): Promise<AnalyzeExerciseResponse> => {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const formData = new FormData()
  formData.append("image", file)

  const res = await fetchWithRetry(`${apiUrl}/api/exercises/analyze`, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "分析に失敗しました"))
  }

  const data = await res.json()
  return analyzeExerciseResponseSchema.parse(data)
}

export const confirmExercise = async (
  exerciseId: string,
  topicId: string,
  markAsUnderstood: boolean
): Promise<ConfirmExerciseResponse> => {
  const res = await api.api.exercises[":exerciseId"].confirm.$post({
    param: { exerciseId },
    json: { topicId, markAsUnderstood },
  })

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "確定に失敗しました"))
  }

  const data = await res.json()
  return confirmExerciseResponseSchema.parse(data)
}

export const getTopicExercises = async (topicId: string): Promise<TopicExercisesResponse> => {
  const res = await api.api.exercises.topics[":topicId"].$get({
    param: { topicId },
  })

  if (!res.ok) {
    throw new Error("問題一覧の取得に失敗しました")
  }

  const data = await res.json()
  return topicExercisesResponseSchema.parse(data)
}
