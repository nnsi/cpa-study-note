import { z } from "zod"
import { api } from "@/lib/api-client"
import {
  studyPlanListResponseSchema,
  studyPlanDetailResponseSchema,
  studyPlanResponseSchema,
  studyPlanItemResponseSchema,
  studyPlanRevisionResponseSchema,
  type StudyPlanResponse,
  type StudyPlanItemResponse,
  type StudyPlanRevisionResponse,
  type StudyPlanDetailResponse,
  type CreateStudyPlanRequest,
  type UpdateStudyPlanRequest,
  type CreateStudyPlanItemRequest,
  type UpdateStudyPlanItemRequest,
  type CreateStudyPlanRevisionRequest,
} from "@cpa-study/shared/schemas"

const planWrapperSchema = z.object({ plan: studyPlanResponseSchema })
const itemWrapperSchema = z.object({ item: studyPlanItemResponseSchema })
const revisionWrapperSchema = z.object({ revision: studyPlanRevisionResponseSchema })

export type { StudyPlanResponse, StudyPlanItemResponse, StudyPlanRevisionResponse, StudyPlanDetailResponse }

export type StudyPlanWithItemCount = StudyPlanResponse & { itemCount: number }

export const getStudyPlans = async (filter?: { archived?: boolean }): Promise<{ plans: StudyPlanWithItemCount[] }> => {
  const query = filter?.archived !== undefined ? { archived: String(filter.archived) } : {}
  const res = await api.api["study-plans"].$get({ query })
  if (!res.ok) throw new Error("Failed to fetch study plans")
  const data = await res.json()
  return studyPlanListResponseSchema.parse(data)
}

export const getStudyPlanDetail = async (planId: string): Promise<StudyPlanDetailResponse> => {
  const res = await api.api["study-plans"][":planId"].$get({ param: { planId } })
  if (!res.ok) throw new Error("Failed to fetch study plan detail")
  const data = await res.json()
  return studyPlanDetailResponseSchema.parse(data)
}

export const createStudyPlan = async (input: CreateStudyPlanRequest): Promise<{ plan: StudyPlanResponse }> => {
  const res = await api.api["study-plans"].$post({ json: input })
  if (!res.ok) throw new Error("Failed to create study plan")
  const data = await res.json()
  return planWrapperSchema.parse(data)
}

export const updateStudyPlan = async (planId: string, input: UpdateStudyPlanRequest): Promise<{ plan: StudyPlanResponse }> => {
  const res = await api.api["study-plans"][":planId"].$patch({ param: { planId }, json: input })
  if (!res.ok) throw new Error("Failed to update study plan")
  const data = await res.json()
  return planWrapperSchema.parse(data)
}

export const archiveStudyPlan = async (planId: string): Promise<void> => {
  const res = await api.api["study-plans"][":planId"].archive.$post({ param: { planId } })
  if (!res.ok) throw new Error("Failed to archive study plan")
}

export const unarchiveStudyPlan = async (planId: string): Promise<void> => {
  const res = await api.api["study-plans"][":planId"].unarchive.$post({ param: { planId } })
  if (!res.ok) throw new Error("Failed to unarchive study plan")
}

export const duplicateStudyPlan = async (planId: string): Promise<{ plan: StudyPlanResponse }> => {
  const res = await api.api["study-plans"][":planId"].duplicate.$post({ param: { planId } })
  if (!res.ok) throw new Error("Failed to duplicate study plan")
  const data = await res.json()
  return planWrapperSchema.parse(data)
}

export const addStudyPlanItem = async (planId: string, input: CreateStudyPlanItemRequest): Promise<{ item: StudyPlanItemResponse }> => {
  const res = await api.api["study-plans"][":planId"].items.$post({ param: { planId }, json: input })
  if (!res.ok) throw new Error("Failed to add study plan item")
  const data = await res.json()
  return itemWrapperSchema.parse(data)
}

export const updateStudyPlanItem = async (planId: string, itemId: string, input: UpdateStudyPlanItemRequest): Promise<{ item: StudyPlanItemResponse }> => {
  const res = await api.api["study-plans"][":planId"].items[":itemId"].$patch({ param: { planId, itemId }, json: input })
  if (!res.ok) throw new Error("Failed to update study plan item")
  const data = await res.json()
  return itemWrapperSchema.parse(data)
}

export const removeStudyPlanItem = async (planId: string, itemId: string): Promise<void> => {
  const res = await api.api["study-plans"][":planId"].items[":itemId"].$delete({ param: { planId, itemId } })
  if (!res.ok) throw new Error("Failed to remove study plan item")
}

export const reorderStudyPlanItems = async (planId: string, itemIds: string[]): Promise<void> => {
  const res = await api.api["study-plans"][":planId"].items.reorder.$put({ param: { planId }, json: { itemIds } })
  if (!res.ok) throw new Error("Failed to reorder study plan items")
}

export const addStudyPlanRevision = async (planId: string, input: CreateStudyPlanRevisionRequest): Promise<{ revision: StudyPlanRevisionResponse }> => {
  const res = await api.api["study-plans"][":planId"].revisions.$post({ param: { planId }, json: input })
  if (!res.ok) throw new Error("Failed to add study plan revision")
  const data = await res.json()
  return revisionWrapperSchema.parse(data)
}
