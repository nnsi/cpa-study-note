import { useState, useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { SuggestedTopic, ExerciseWithImage } from "@cpa-study/shared/schemas"
import * as api from "./api"

type AnalyzeState = {
  status: "idle" | "analyzing" | "done" | "error"
  exerciseId: string | null
  imageId: string | null
  ocrText: string | null
  suggestedTopics: SuggestedTopic[]
  previewUrl: string | null
  error: string | null
}

export const useExerciseAnalyze = () => {
  const [state, setState] = useState<AnalyzeState>({
    status: "idle",
    exerciseId: null,
    imageId: null,
    ocrText: null,
    suggestedTopics: [],
    previewUrl: null,
    error: null,
  })

  const reset = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl)
    }
    setState({
      status: "idle",
      exerciseId: null,
      imageId: null,
      ocrText: null,
      suggestedTopics: [],
      previewUrl: null,
      error: null,
    })
  }, [state.previewUrl])

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      setState((prev) => ({
        ...prev,
        status: "analyzing",
        previewUrl: URL.createObjectURL(file),
        error: null,
      }))

      const result = await api.analyzeExercise(file)

      setState((prev) => ({
        ...prev,
        status: "done",
        exerciseId: result.exerciseId,
        imageId: result.imageId,
        ocrText: result.ocrText,
        suggestedTopics: result.suggestedTopics,
      }))

      return result
    },
    onError: (error: Error) => {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: error.message,
      }))
    },
  })

  const analyze = useCallback(
    (file: File) => {
      analyzeMutation.mutate(file)
    },
    [analyzeMutation]
  )

  return {
    ...state,
    analyze,
    reset,
    isAnalyzing: state.status === "analyzing",
  }
}

export const useExerciseConfirm = () => {
  const queryClient = useQueryClient()

  const confirmMutation = useMutation({
    mutationFn: async ({
      exerciseId,
      topicId,
      markAsUnderstood,
    }: {
      exerciseId: string
      topicId: string
      markAsUnderstood: boolean
    }) => {
      return api.confirmExercise(exerciseId, topicId, markAsUnderstood)
    },
    onSuccess: (_, variables) => {
      // 論点の問題一覧キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ["topicExercises", variables.topicId] })
    },
  })

  return {
    confirm: confirmMutation.mutate,
    confirmAsync: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,
    error: confirmMutation.error,
  }
}

export const useTopicExercises = (topicId: string | undefined) => {
  return useQuery<{ exercises: ExerciseWithImage[] }>({
    queryKey: ["topicExercises", topicId],
    queryFn: () => api.getTopicExercises(topicId!),
    enabled: !!topicId,
  })
}
