import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as api from "../api"

/**
 * ユーザーが参加している学習領域一覧を取得するフック
 */
export function useUserStudyDomains() {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user-study-domains"],
    queryFn: api.getUserStudyDomains,
  })

  return {
    userStudyDomains: data?.userStudyDomains ?? [],
    isLoading,
    error,
  }
}

/**
 * 学習領域に参加するミューテーション
 */
export function useJoinStudyDomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.joinStudyDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-study-domains"] })
    },
  })
}

/**
 * 学習領域から離脱するミューテーション
 */
export function useLeaveStudyDomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.leaveStudyDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-study-domains"] })
    },
  })
}
