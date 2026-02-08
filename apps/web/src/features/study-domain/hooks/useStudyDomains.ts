import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as api from "../api"

/**
 * ユーザーの学習領域一覧を取得するフック
 */
export const useStudyDomains = () => {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["study-domains"],
    queryFn: api.getStudyDomains,
  })

  return {
    studyDomains: data?.studyDomains ?? [],
    isLoading,
    error,
  }
}

/**
 * 学習領域を作成するミューテーション
 */
export const useCreateStudyDomain = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.createStudyDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-domains"] })
    },
  })
}

/**
 * 学習領域を更新するミューテーション
 */
export const useUpdateStudyDomain = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: api.UpdateStudyDomainInput }) =>
      api.updateStudyDomain(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-domains"] })
    },
  })
}

/**
 * 学習領域を削除するミューテーション
 */
export const useDeleteStudyDomain = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.deleteStudyDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-domains"] })
    },
  })
}
