import { useState, useCallback, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"
import {
  parseSuggestionsFromText,
  createInitialSelection,
  countSelected,
  type SuggestionsResult,
  type SelectionState,
} from "./logic"
import {
  getSubjectTree,
  updateSubjectTree,
  type CategoryNodeInput,
} from "@/features/subject/api"

/**
 * AI論点提案のストリーミングと選択状態を管理するフック
 */
export function useTopicSuggestion(subjectId: string) {
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestionsResult | null>(null)
  const [selection, setSelection] = useState<SelectionState>(new Map())
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const suggest = useCallback(
    async (prompt: string) => {
      abort()
      const controller = new AbortController()
      abortRef.current = controller

      setStreamingText("")
      setIsStreaming(true)
      setSuggestions(null)
      setSelection(new Map())
      setError(null)

      let fullText = ""
      let textBuffer = ""
      let rafId: number | null = null

      const flushBuffer = () => {
        const text = textBuffer
        textBuffer = ""
        rafId = null
        if (text) {
          setStreamingText((prev) => prev + text)
        }
      }

      try {
        for await (const chunk of api.suggestTopics(subjectId, prompt, controller.signal)) {
          if (chunk.type === "text" && chunk.content) {
            fullText += chunk.content
            textBuffer += chunk.content
            if (!rafId) {
              rafId = requestAnimationFrame(flushBuffer)
            }
          } else if (chunk.type === "done") {
            if (rafId) cancelAnimationFrame(rafId)
            flushBuffer()
            const parsed = parseSuggestionsFromText(fullText)
            if (parsed) {
              setSuggestions(parsed)
              setSelection(createInitialSelection(parsed))
            }
          } else if (chunk.type === "error") {
            setError(chunk.error ?? "エラーが発生しました")
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "エラーが発生しました")
      } finally {
        setIsStreaming(false)
        if (rafId) cancelAnimationFrame(rafId)
        flushBuffer()
      }
    },
    [subjectId, abort]
  )

  return {
    streamingText,
    isStreaming,
    suggestions,
    selection,
    setSelection,
    error,
    suggest,
    abort,
    selectedCount: countSelected(selection),
  }
}

/**
 * 提案された論点を科目ツリーに一括追加するミューテーション
 */
export function useAddSuggestedTopics(subjectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      suggestions,
      selection,
    }: {
      suggestions: SuggestionsResult
      selection: SelectionState
    }) => {
      // 1. 現在のツリーを取得
      const treeData = await getSubjectTree(subjectId)
      const currentTree = treeData.tree

      // 2. 選択された提案をツリーに追加
      // Response型からInput型へ変換（Response: id: string, Input: id: string | null）
      const updatedCategories: CategoryNodeInput[] = currentTree.categories.map((c) => ({
        ...c,
        subcategories: c.subcategories.map((s) => ({
          ...s,
          topics: s.topics.map((t) => ({ ...t })),
        })),
      }))
      let maxCategoryOrder = Math.max(
        ...currentTree.categories.map((c) => c.displayOrder),
        -1
      )

      for (const suggestedCat of suggestions.categories) {
        const selectedTopics = selection.get(suggestedCat.name)
        if (!selectedTopics || selectedTopics.size === 0) continue

        // 既存カテゴリを探す
        const existingCategory = updatedCategories.find(
          (c) => c.name === suggestedCat.name
        )

        if (existingCategory) {
          // 既存カテゴリの最初のサブカテゴリに追加（なければ作成）
          if (existingCategory.subcategories.length === 0) {
            existingCategory.subcategories.push({
              id: null,
              name: suggestedCat.name,
              displayOrder: 0,
              topics: [],
            })
          }
          const targetSubcat = existingCategory.subcategories[0]
          let maxOrder = Math.max(
            ...targetSubcat.topics.map((t) => t.displayOrder),
            -1
          )

          for (const topic of suggestedCat.topics) {
            if (selectedTopics.has(topic.name)) {
              targetSubcat.topics.push({
                id: null,
                name: topic.name,
                description: topic.description,
                displayOrder: ++maxOrder,
                difficulty: null,
                topicType: null,
                aiSystemPrompt: null,
              })
            }
          }
        } else {
          // 新規カテゴリ作成
          maxCategoryOrder++
          const newTopics = suggestedCat.topics
            .filter((t) => selectedTopics.has(t.name))
            .map((t, i) => ({
              id: null,
              name: t.name,
              description: t.description,
              displayOrder: i,
              difficulty: null,
              topicType: null,
              aiSystemPrompt: null,
            }))

          updatedCategories.push({
            id: null,
            name: suggestedCat.name,
            displayOrder: maxCategoryOrder,
            subcategories: [
              {
                id: null,
                name: suggestedCat.name,
                displayOrder: 0,
                topics: newTopics,
              },
            ],
          })
        }
      }

      // 3. ツリーを更新
      await updateSubjectTree(subjectId, { categories: updatedCategories })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", subjectId, "tree"] })
      queryClient.invalidateQueries({ queryKey: ["subjects"] })
    },
  })
}
