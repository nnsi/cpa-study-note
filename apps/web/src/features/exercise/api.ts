import { api } from "@/lib/api-client"
import { useAuthStore, refreshTokenOnUnauthorized } from "@/lib/auth"
import {
  analyzeExerciseResponseSchema,
  confirmExerciseResponseSchema,
  topicExercisesResponseSchema,
  type AnalyzeExerciseResponse,
  type ConfirmExerciseResponse,
  type TopicExercisesResponse,
} from "@cpa-study/shared/schemas"

// multipart/form-dataはHono RPCでサポートされていないため直接fetchを使用
const getAuthHeaders = (): Record<string, string> => {
  const { token } = useAuthStore.getState()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

const fetchWithAuth = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      ...getAuthHeaders(),
    },
    credentials: "include",
  })

  if (response.status === 401) {
    const newToken = await refreshTokenOnUnauthorized()
    if (newToken) {
      return fetch(input, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${newToken}`,
        },
        credentials: "include",
      })
    }
  }

  return response
}

export const analyzeExercise = async (file: File): Promise<AnalyzeExerciseResponse> => {
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const formData = new FormData()
  formData.append("image", file)

  const res = await fetchWithAuth(`${apiUrl}/api/exercises/analyze`, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: { message: "分析に失敗しました" } })) as { error?: { message?: string } }
    throw new Error(errorData.error?.message || "分析に失敗しました")
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
    const error = await res.json().catch(() => ({ error: { message: "確定に失敗しました" } }))
    throw new Error((error as { error?: { message?: string } }).error?.message || "確定に失敗しました")
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
