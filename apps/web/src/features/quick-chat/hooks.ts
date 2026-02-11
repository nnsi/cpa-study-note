import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import * as api from "./api"
import type { QuickChatSuggestion } from "@cpa-study/shared/schemas"

type UseQuickChatOptions = {
  domainId: string | null
}

export const useQuickChat = ({ domainId }: UseQuickChatOptions) => {
  const [question, setQuestion] = useState("")
  const [suggestions, setSuggestions] = useState<QuickChatSuggestion[] | null>(null)
  const navigate = useNavigate()

  const suggestMutation = useMutation({
    mutationFn: ({ domainId, question }: { domainId: string; question: string }) =>
      api.suggestTopics(domainId, question),
    onSuccess: (data) => {
      setSuggestions(data.suggestions)
    },
  })

  const handleSubmitQuestion = useCallback(() => {
    if (!question.trim() || !domainId || suggestMutation.isPending) return
    setSuggestions(null)
    suggestMutation.mutate({ domainId, question: question.trim() })
  }, [question, domainId, suggestMutation])

  const handleSelectExistingTopic = useCallback(
    (suggestion: QuickChatSuggestion) => {
      if (!domainId || !suggestion.topicId || !suggestion.subjectId || !suggestion.categoryId) return

      // チャット画面に遷移（質問テキストをsearchParamsで渡す）
      navigate({
        to: "/domains/$domainId/subjects/$subjectId/$categoryId/$topicId",
        params: {
          domainId,
          subjectId: suggestion.subjectId,
          categoryId: suggestion.categoryId,
          topicId: suggestion.topicId,
        },
        search: { quickChatQuestion: question },
      })
    },
    [domainId, question, navigate]
  )

  const handleClear = useCallback(() => {
    setQuestion("")
    setSuggestions(null)
    suggestMutation.reset()
  }, [suggestMutation])

  return {
    question,
    setQuestion,
    suggestions,
    isLoading: suggestMutation.isPending,
    error: suggestMutation.error,
    handleSubmitQuestion,
    handleSelectExistingTopic,
    handleClear,
  }
}
