import type { TopicSearchResult } from "./api"

/**
 * 検索結果から論点詳細へのURLを生成
 */
export const getTopicUrl = (result: TopicSearchResult): string => {
  return `/domains/${result.studyDomainId}/subjects/${result.subjectId}/${result.categoryId}/${result.id}`
}

/**
 * キーボードショートカットが検索開始のものかを判定
 * Ctrl+K (Windows/Linux) or Cmd+K (Mac)
 */
export const isSearchShortcut = (e: KeyboardEvent): boolean => {
  // SSR/非ブラウザ環境のガード
  if (typeof navigator === "undefined") return false

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
  const modifier = isMac ? e.metaKey : e.ctrlKey
  return modifier && e.key.toLowerCase() === "k"
}

/**
 * 検索クエリをハイライト付きで表示するための分割
 */
export const highlightMatch = (
  text: string,
  query: string
): { text: string; highlight: boolean }[] => {
  if (!query) {
    return [{ text, highlight: false }]
  }

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) {
    return [{ text, highlight: false }]
  }

  const result: { text: string; highlight: boolean }[] = []

  if (index > 0) {
    result.push({ text: text.slice(0, index), highlight: false })
  }

  result.push({ text: text.slice(index, index + query.length), highlight: true })

  if (index + query.length < text.length) {
    result.push({ text: text.slice(index + query.length), highlight: false })
  }

  return result
}
