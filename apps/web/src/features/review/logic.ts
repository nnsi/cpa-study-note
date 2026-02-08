import type { FilteredTopic, TopicFilterParams } from "./api"

/**
 * フィルタ条件からURLのクエリパラメータを生成
 */
export const buildFilterQueryString = (params: TopicFilterParams): string => {
  const searchParams = new URLSearchParams()

  if (params.minSessionCount !== undefined && params.minSessionCount > 0) {
    searchParams.set("minSessionCount", String(params.minSessionCount))
  }
  if (params.daysSinceLastChat !== undefined && params.daysSinceLastChat > 0) {
    searchParams.set("daysSinceLastChat", String(params.daysSinceLastChat))
  }
  if (params.understood !== undefined) {
    searchParams.set("understood", String(params.understood))
  }
  if (
    params.minGoodQuestionCount !== undefined &&
    params.minGoodQuestionCount > 0
  ) {
    searchParams.set("minGoodQuestionCount", String(params.minGoodQuestionCount))
  }

  const str = searchParams.toString()
  return str ? `?${str}` : ""
}

/**
 * URLクエリパラメータからフィルタ条件を復元
 */
export const parseFilterFromQueryString = (
  searchParams: URLSearchParams
): TopicFilterParams => {
  const params: TopicFilterParams = {}

  const minSessionCount = searchParams.get("minSessionCount")
  if (minSessionCount) {
    params.minSessionCount = parseInt(minSessionCount, 10)
  }

  const daysSinceLastChat = searchParams.get("daysSinceLastChat")
  if (daysSinceLastChat) {
    params.daysSinceLastChat = parseInt(daysSinceLastChat, 10)
  }

  const understood = searchParams.get("understood")
  if (understood === "true") {
    params.understood = true
  } else if (understood === "false") {
    params.understood = false
  }

  const minGoodQuestionCount = searchParams.get("minGoodQuestionCount")
  if (minGoodQuestionCount) {
    params.minGoodQuestionCount = parseInt(minGoodQuestionCount, 10)
  }

  return params
}

/**
 * フィルタ条件が空かどうかを判定
 */
export const isFilterEmpty = (params: TopicFilterParams): boolean => {
  return (
    params.minSessionCount === undefined &&
    params.daysSinceLastChat === undefined &&
    params.understood === undefined &&
    params.minGoodQuestionCount === undefined
  )
}

/**
 * 論点を科目別にグループ化
 */
export const groupTopicsBySubject = (
  topics: FilteredTopic[]
): Map<string, { subjectName: string; topics: FilteredTopic[] }> => {
  const grouped = new Map<string, { subjectName: string; topics: FilteredTopic[] }>()

  for (const topic of topics) {
    const existing = grouped.get(topic.subjectId)
    if (existing) {
      existing.topics.push(topic)
    } else {
      grouped.set(topic.subjectId, {
        subjectName: topic.subjectName,
        topics: [topic],
      })
    }
  }

  return grouped
}

/**
 * 最終チャット日を日本語で表示
 */
export const formatLastChatDate = (lastChatAt: string | null): string => {
  if (!lastChatAt) {
    return "チャットなし"
  }

  const date = new Date(lastChatAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return "今日"
  } else if (diffDays === 1) {
    return "昨日"
  } else if (diffDays < 7) {
    return `${diffDays}日前`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}週間前`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}ヶ月前`
  } else {
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }
}

/**
 * フィルタ条件の要約を表示
 */
export const summarizeFilters = (params: TopicFilterParams): string[] => {
  const summaries: string[] = []

  if (params.understood === true) {
    summaries.push("チェック済み")
  } else if (params.understood === false) {
    summaries.push("未チェック")
  }

  if (params.minSessionCount !== undefined && params.minSessionCount > 0) {
    summaries.push(`${params.minSessionCount}セッション以上`)
  }

  if (params.daysSinceLastChat !== undefined && params.daysSinceLastChat > 0) {
    summaries.push(`${params.daysSinceLastChat}日以上経過`)
  }

  if (
    params.minGoodQuestionCount !== undefined &&
    params.minGoodQuestionCount > 0
  ) {
    summaries.push(`良質な質問${params.minGoodQuestionCount}件以上`)
  }

  return summaries
}
