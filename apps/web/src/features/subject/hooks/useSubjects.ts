import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as api from "../api"

/**
 * 科目一覧を取得するフック
 */
export function useSubjects(domainId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["subjects", domainId],
    queryFn: () => api.getSubjects(domainId!),
    enabled: !!domainId,
  })

  return {
    subjects: data?.subjects ?? [],
    isLoading,
    error,
  }
}

/**
 * 科目を取得するフック
 */
export function useSubject(id: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["subject", id],
    queryFn: () => api.getSubject(id!),
    enabled: !!id,
  })

  return {
    subject: data?.subject,
    isLoading,
    error,
  }
}

/**
 * 科目を作成するミューテーション
 */
export function useCreateSubject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ domainId, data }: { domainId: string; data: api.CreateSubjectInput }) =>
      api.createSubject(domainId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subjects", variables.domainId] })
    },
  })
}

/**
 * 科目を更新するミューテーション
 */
export function useUpdateSubject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: api.UpdateSubjectInput }) =>
      api.updateSubject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] })
      queryClient.invalidateQueries({ queryKey: ["subject"] })
    },
  })
}

/**
 * 科目を削除するミューテーション
 */
export function useDeleteSubject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] })
    },
  })
}

/**
 * 科目のツリーを取得するフック
 */
export function useSubjectTree(id: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["subject-tree", id],
    queryFn: () => api.getSubjectTree(id!),
    enabled: !!id,
  })

  return {
    tree: data?.tree,
    isLoading,
    error,
    refetch,
  }
}

/**
 * 科目のツリーを更新するミューテーション
 */
export function useUpdateSubjectTree() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, tree }: { id: string; tree: api.UpdateTreeInput }) =>
      api.updateSubjectTree(id, tree),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subject-tree", variables.id] })
    },
  })
}

/**
 * CSVインポートのミューテーション
 */
export function useImportCSV() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, csvContent }: { id: string; csvContent: string }) =>
      api.importCSV(id, csvContent),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subject-tree", variables.id] })
    },
  })
}
