import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"
import type { CreateStudyPlanRequest, UpdateStudyPlanRequest, CreateStudyPlanItemRequest, UpdateStudyPlanItemRequest, CreateStudyPlanRevisionRequest } from "@cpa-study/shared/schemas"

export const useStudyPlans = (filter?: { archived?: boolean }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["study-plans", filter],
    queryFn: () => api.getStudyPlans(filter),
  })
  return { plans: data?.plans ?? [], isLoading, error }
}

export const useStudyPlanDetail = (planId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["study-plans", planId],
    queryFn: () => api.getStudyPlanDetail(planId),
    enabled: !!planId,
  })
  return { data, isLoading, error }
}

export const useCreateStudyPlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStudyPlanRequest) => api.createStudyPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans"] })
    },
  })
}

export const useUpdateStudyPlan = (planId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateStudyPlanRequest) => api.updateStudyPlan(planId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans"] })
    },
  })
}

export const useArchiveStudyPlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => api.archiveStudyPlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans"] })
    },
  })
}

export const useUnarchiveStudyPlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => api.unarchiveStudyPlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans"] })
    },
  })
}

export const useDuplicateStudyPlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => api.duplicateStudyPlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans"] })
    },
  })
}

export const useAddStudyPlanItem = (planId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStudyPlanItemRequest) => api.addStudyPlanItem(planId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans", planId] })
    },
  })
}

export const useUpdateStudyPlanItem = (planId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateStudyPlanItemRequest }) =>
      api.updateStudyPlanItem(planId, itemId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans", planId] })
    },
  })
}

export const useRemoveStudyPlanItem = (planId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => api.removeStudyPlanItem(planId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans", planId] })
    },
  })
}

export const useReorderStudyPlanItems = (planId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemIds: string[]) => api.reorderStudyPlanItems(planId, itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans", planId] })
    },
  })
}

export const useAddStudyPlanRevision = (planId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStudyPlanRevisionRequest) => api.addStudyPlanRevision(planId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-plans", planId] })
    },
  })
}
