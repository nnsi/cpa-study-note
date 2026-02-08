import { useState, useCallback, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import * as aiApi from "./ai-api"
import * as api from "./api"
import {
  parsePlanSuggestionsFromText,
  createInitialPlanSelection,
  type PlanSuggestionsResult,
  type PlanSelectionState,
} from "./ai-logic"

/**
 * AI計画要素提案のストリーミングと選択状態を管理するフック
 */
export function usePlanSuggestion(planId: string) {
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [suggestions, setSuggestions] = useState<PlanSuggestionsResult | null>(null)
  const [selection, setSelection] = useState<PlanSelectionState>(new Set())
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
      setSelection(new Set())
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
        for await (const chunk of aiApi.suggestPlanItems(planId, prompt, controller.signal)) {
          if (chunk.type === "text" && chunk.content) {
            fullText += chunk.content
            textBuffer += chunk.content
            if (!rafId) {
              rafId = requestAnimationFrame(flushBuffer)
            }
          } else if (chunk.type === "done") {
            if (rafId) cancelAnimationFrame(rafId)
            flushBuffer()
            const parsed = parsePlanSuggestionsFromText(fullText)
            if (parsed) {
              setSuggestions(parsed)
              setSelection(createInitialPlanSelection(parsed))
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
    [planId, abort]
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
  }
}

/**
 * 提案された計画要素を一括追加するミューテーション
 */
export function useAddSuggestedPlanItems(planId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      suggestions,
      selection,
      currentItemCount,
    }: {
      suggestions: PlanSuggestionsResult
      selection: PlanSelectionState
      currentItemCount: number
    }) => {
      let orderIndex = currentItemCount
      for (let i = 0; i < suggestions.items.length; i++) {
        if (!selection.has(i)) continue
        const item = suggestions.items[i]
        await api.addStudyPlanItem(planId, {
          description: item.description,
          rationale: item.rationale ?? undefined,
          orderIndex: orderIndex++,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans", planId] })
    },
  })
}
