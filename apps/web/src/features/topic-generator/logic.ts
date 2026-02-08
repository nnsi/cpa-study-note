import { topicSuggestionSchema, type TopicSuggestions } from "@cpa-study/shared/schemas"

export type TopicSuggestion = TopicSuggestions["categories"][number]["topics"][number]
export type CategorySuggestion = TopicSuggestions["categories"][number]
export type SuggestionsResult = TopicSuggestions

/**
 * AIレスポンステキストからJSON部分をパースする。
 * ```json ... ``` ブロックを優先し、なければ最後の { ... } を試す。
 * Zodスキーマでバリデーションし、不正な形式は除外する。
 */
export const parseSuggestionsFromText = (text: string): SuggestionsResult | null => {
  const tryParse = (jsonStr: string): SuggestionsResult | null => {
    try {
      const raw = JSON.parse(jsonStr)
      const result = topicSuggestionSchema.safeParse(raw)
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

// 選択状態を管理するための型
export type SelectionState = Map<string, Set<string>> // categoryName -> Set<topicName>

export const createInitialSelection = (suggestions: SuggestionsResult): SelectionState => {
  const selection = new Map<string, Set<string>>()
  for (const cat of suggestions.categories) {
    selection.set(cat.name, new Set(cat.topics.map((t) => t.name)))
  }
  return selection
}

export const countSelected = (selection: SelectionState): number => {
  let count = 0
  for (const topics of selection.values()) {
    count += topics.size
  }
  return count
}

export const toggleTopic = (
  selection: SelectionState,
  categoryName: string,
  topicName: string
): SelectionState => {
  const newSelection = new Map(selection)
  const topics = new Set(newSelection.get(categoryName) ?? [])
  if (topics.has(topicName)) {
    topics.delete(topicName)
  } else {
    topics.add(topicName)
  }
  newSelection.set(categoryName, topics)
  return newSelection
}

export const toggleCategory = (
  selection: SelectionState,
  categoryName: string,
  allTopics: string[]
): SelectionState => {
  const newSelection = new Map(selection)
  const current = newSelection.get(categoryName) ?? new Set()
  if (current.size === allTopics.length) {
    newSelection.set(categoryName, new Set())
  } else {
    newSelection.set(categoryName, new Set(allTopics))
  }
  return newSelection
}
