import { useState, useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import * as api from "./api"
import type { TopicFilterParams, FilteredTopic } from "./api"
import {
  parseFilterFromQueryString,
  isFilterEmpty,
  groupTopicsBySubject,
} from "./logic"

type UseTopicFilterReturn = {
  // フィルタ状態
  filters: TopicFilterParams
  setFilters: (params: TopicFilterParams) => void
  updateFilter: <K extends keyof TopicFilterParams>(
    key: K,
    value: TopicFilterParams[K]
  ) => void
  resetFilters: () => void
  hasFilters: boolean

  // 検索結果
  topics: FilteredTopic[]
  groupedTopics: Map<string, { subjectName: string; topics: FilteredTopic[] }>
  isLoading: boolean
  isError: boolean
  error: Error | null
  totalCount: number

  // アクション
  applyFilters: () => void
}

export const useTopicFilter = (): UseTopicFilterReturn => {
  const navigate = useNavigate()
  const searchParams = useSearch({ from: "/review" }) as Record<string, string>

  // URLからフィルタ条件を復元
  const initialFilters = useMemo(() => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value)
    }
    return parseFilterFromQueryString(params)
  }, [searchParams])

  // フィルタ条件の状態（フォーム入力用）
  const [pendingFilters, setPendingFilters] =
    useState<TopicFilterParams>(initialFilters)

  // フィルタ条件更新
  const updateFilter = useCallback(
    <K extends keyof TopicFilterParams>(
      key: K,
      value: TopicFilterParams[K]
    ) => {
      setPendingFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // フィルタリセット
  const resetFilters = useCallback(() => {
    setPendingFilters({})
    navigate({ to: "/review", search: {} })
  }, [navigate])

  // フィルタ適用（URLを更新してクエリを再実行）
  const applyFilters = useCallback(() => {
    const search: Record<string, string> = {}

    if (
      pendingFilters.minSessionCount !== undefined &&
      pendingFilters.minSessionCount > 0
    ) {
      search.minSessionCount = String(pendingFilters.minSessionCount)
    }
    if (
      pendingFilters.daysSinceLastChat !== undefined &&
      pendingFilters.daysSinceLastChat > 0
    ) {
      search.daysSinceLastChat = String(pendingFilters.daysSinceLastChat)
    }
    if (pendingFilters.understood !== undefined) {
      search.understood = String(pendingFilters.understood)
    }
    if (
      pendingFilters.minGoodQuestionCount !== undefined &&
      pendingFilters.minGoodQuestionCount > 0
    ) {
      search.minGoodQuestionCount = String(pendingFilters.minGoodQuestionCount)
    }

    navigate({ to: "/review", search })
  }, [navigate, pendingFilters])

  // API クエリ
  const {
    data: topics = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["topics", "filter", initialFilters],
    queryFn: () => api.filterTopics(initialFilters),
    enabled: !isFilterEmpty(initialFilters),
  })

  // 科目別グループ化
  const groupedTopics = useMemo(() => groupTopicsBySubject(topics), [topics])

  return {
    filters: pendingFilters,
    setFilters: setPendingFilters,
    updateFilter,
    resetFilters,
    hasFilters: !isFilterEmpty(initialFilters),

    topics,
    groupedTopics,
    isLoading,
    isError,
    error: error ?? null,
    totalCount: topics.length,

    applyFilters,
  }
}
