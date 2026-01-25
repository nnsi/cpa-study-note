import { useQuery } from "@tanstack/react-query"
import * as api from "./api"

export const useTodayMetrics = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics", "today"],
    queryFn: api.getTodayMetrics,
    // 5分ごとに自動リフェッチ
    refetchInterval: 5 * 60 * 1000,
  })

  return {
    metrics: data?.metrics ?? null,
    isLoading,
    error,
  }
}

export const useRecentTopics = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["topics", "recent"],
    queryFn: api.getRecentTopics,
  })

  return {
    topics: data?.topics ?? [],
    isLoading,
    error,
  }
}
