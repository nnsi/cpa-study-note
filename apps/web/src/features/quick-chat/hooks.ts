import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import * as api from "./api"
import {
  getSubjectTree,
  updateSubjectTree,
  type CategoryNodeInput,
} from "@/features/subject/api"
import type { QuickChatSuggestion } from "@cpa-study/shared/schemas"

type UseQuickChatOptions = {
  domainId: string | null
}

export const useQuickChat = ({ domainId }: UseQuickChatOptions) => {
  const [question, setQuestion] = useState("")
  const [suggestions, setSuggestions] = useState<QuickChatSuggestion[] | null>(null)
  const [confirmingNewTopic, setConfirmingNewTopic] = useState<QuickChatSuggestion | null>(null)
  const [isCreatingTopic, setIsCreatingTopic] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
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
    setConfirmingNewTopic(null)
    setCreateError(null)
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

  const handleSelectNewTopic = useCallback(
    (suggestion: QuickChatSuggestion) => {
      if (!suggestion.subjectId) return
      setConfirmingNewTopic(suggestion)
      setCreateError(null)
    },
    []
  )

  const handleCancelNewTopic = useCallback(() => {
    setConfirmingNewTopic(null)
    setCreateError(null)
  }, [])

  const handleConfirmNewTopic = useCallback(async () => {
    if (!confirmingNewTopic || !domainId || !confirmingNewTopic.subjectId || isCreatingTopic) return

    const { subjectId, categoryId, topicName, categoryName } = confirmingNewTopic
    setIsCreatingTopic(true)
    setCreateError(null)

    try {
      // 1. 現在のツリーを取得
      const treeData = await getSubjectTree(subjectId)
      const currentTree = treeData.tree

      // 2. Input型に変換（id: string → id: string | null）
      const updatedCategories: CategoryNodeInput[] = currentTree.categories.map((c) => ({
        ...c,
        id: c.id as string | null,
        subcategories: c.subcategories.map((s) => ({
          ...s,
          id: s.id as string | null,
          topics: s.topics.map((t) => ({ ...t, id: t.id as string | null })),
        })),
      }))

      // 3. 新トピック追加
      if (categoryId) {
        // 既存カテゴリ（depth=2）に追加
        let found = false
        for (const cat of updatedCategories) {
          for (const subcat of cat.subcategories) {
            if (subcat.id === categoryId) {
              const maxOrder = Math.max(...subcat.topics.map((t) => t.displayOrder), -1)
              subcat.topics.push({
                id: null,
                name: topicName,
                displayOrder: maxOrder + 1,
                description: null,
                difficulty: null,
                topicType: null,
                aiSystemPrompt: null,
              })
              found = true
              break
            }
          }
          if (found) break
        }
        if (!found) {
          throw new Error("カテゴリが見つかりません")
        }
      } else {
        // 新規カテゴリ（depth=1 + depth=2）を作成
        const maxOrder = Math.max(...updatedCategories.map((c) => c.displayOrder), -1)
        updatedCategories.push({
          id: null,
          name: categoryName,
          displayOrder: maxOrder + 1,
          subcategories: [
            {
              id: null,
              name: categoryName,
              displayOrder: 0,
              topics: [
                {
                  id: null,
                  name: topicName,
                  displayOrder: 0,
                  description: null,
                  difficulty: null,
                  topicType: null,
                  aiSystemPrompt: null,
                },
              ],
            },
          ],
        })
      }

      // 4. ツリー更新
      const result = await updateSubjectTree(subjectId, { categories: updatedCategories })

      // 5. レスポンスから新トピックのIDを取得（名前マッチ）
      let newTopicId: string | null = null
      let newCategoryId: string | null = null
      for (const cat of result.tree.categories) {
        for (const subcat of cat.subcategories) {
          for (const topic of subcat.topics) {
            if (topic.name === topicName) {
              newTopicId = topic.id
              newCategoryId = subcat.id
            }
          }
        }
      }

      if (!newTopicId || !newCategoryId) {
        throw new Error("作成した論点が見つかりません")
      }

      // 6. チャット画面に遷移
      navigate({
        to: "/domains/$domainId/subjects/$subjectId/$categoryId/$topicId",
        params: {
          domainId,
          subjectId,
          categoryId: newCategoryId,
          topicId: newTopicId,
        },
        search: { quickChatQuestion: question },
      })
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "論点の作成に失敗しました")
    } finally {
      setIsCreatingTopic(false)
    }
  }, [confirmingNewTopic, domainId, isCreatingTopic, question, navigate])

  const handleClear = useCallback(() => {
    setQuestion("")
    setSuggestions(null)
    setConfirmingNewTopic(null)
    setCreateError(null)
    suggestMutation.reset()
  }, [suggestMutation])

  return {
    question,
    setQuestion,
    suggestions,
    isLoading: suggestMutation.isPending,
    error: suggestMutation.error,
    confirmingNewTopic,
    isCreatingTopic,
    createError,
    handleSubmitQuestion,
    handleSelectExistingTopic,
    handleSelectNewTopic,
    handleConfirmNewTopic,
    handleCancelNewTopic,
    handleClear,
  }
}
