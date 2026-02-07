import { planItemSuggestionSchema, type PlanItemSuggestions } from "@cpa-study/shared/schemas"

export type SuggestedItem = PlanItemSuggestions["items"][number]
export type PlanSuggestionsResult = PlanItemSuggestions

/**
 * AIレスポンステキストからJSON部分をパースする。
 * ```json ... ``` ブロックを優先し、なければ最初の { ... } を試す。
 */
export const parsePlanSuggestionsFromText = (text: string): PlanSuggestionsResult | null => {
  const tryParse = (jsonStr: string): PlanSuggestionsResult | null => {
    try {
      const raw = JSON.parse(jsonStr)
      const result = planItemSuggestionSchema.safeParse(raw)
      return result.success ? result.data : null
    } catch {
      return null
    }
  }

  // ```json ... ``` ブロックを優先
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (jsonMatch) {
    const result = tryParse(jsonMatch[1].trim())
    if (result) return result
  }

  // JSONブロックなしの場合、最初にパースに成功する { を探す
  for (let i = text.indexOf("{"); i !== -1; i = text.indexOf("{", i + 1)) {
    const result = tryParse(text.slice(i))
    if (result) return result
  }
  return null
}

// 選択状態: Set<index>
export type PlanSelectionState = Set<number>

export const createInitialPlanSelection = (suggestions: PlanSuggestionsResult): PlanSelectionState => {
  return new Set(suggestions.items.map((_, i) => i))
}

export const togglePlanItem = (selection: PlanSelectionState, index: number): PlanSelectionState => {
  const newSelection = new Set(selection)
  if (newSelection.has(index)) {
    newSelection.delete(index)
  } else {
    newSelection.add(index)
  }
  return newSelection
}

export const toggleAllPlanItems = (selection: PlanSelectionState, total: number): PlanSelectionState => {
  if (selection.size === total) {
    return new Set()
  }
  return new Set(Array.from({ length: total }, (_, i) => i))
}
