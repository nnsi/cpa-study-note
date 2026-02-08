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
  type UpdateStudyPlanRevisionRequest,
} from "@cpa-study/shared/schemas"

const planWrapperSchema = z.object({ plan: studyPlanResponseSchema })
const itemWrapperSchema = z.object({ item: studyPlanItemResponseSchema })
const revisionWrapperSchema = z.object({ revision: studyPlanRevisionResponseSchema })

export type { StudyPlanResponse, StudyPlanItemResponse, StudyPlanRevisionResponse, StudyPlanDetailResponse }

export type StudyPlanWithItemCount = StudyPlanResponse & { itemCount: number }

export const getStudyPlans = async (filter?: { archived?: boolean }): Promise<{ plans: StudyPlanWithItemCount[] }> => {
  const query = filter?.archived !== undefined ? { archived: String(filter.archived) } : {}
  const res = await api.api["study-plans"].$get({ query })
  if (!res.ok) throw new Error("学習計画の取得に失敗しました")
  const data = await res.json()
  return studyPlanListResponseSchema.parse(data)
}

export const getStudyPlanDetail = async (planId: string): Promise<StudyPlanDetailResponse> => {
  const res = await api.api["study-plans"][":planId"].$get({ param: { planId } })
  if (!res.ok) throw new Error("学習計画の詳細取得に失敗しました")
  const data = await res.json()
  return studyPlanDetailResponseSchema.parse(data)
}

export const createStudyPlan = async (input: CreateStudyPlanRequest): Promise<{ plan: StudyPlanResponse }> => {
  const res = await api.api["study-plans"].$post({ json: input })
  if (!res.ok) throw new Error("学習計画の作成に失敗しました")
  const data = await res.json()
  return planWrapperSchema.parse(data)
}

export const updateStudyPlan = async (planId: string, input: UpdateStudyPlanRequest): Promise<{ plan: StudyPlanResponse }> => {
  const res = await api.api["study-plans"][":planId"].$patch({ param: { planId }, json: input })
  if (!res.ok) throw new Error("学習計画の更新に失敗しました")
  const data = await res.json()
  return planWrapperSchema.parse(data)
}

export const archiveStudyPlan = async (planId: string): Promise<void> => {
  const res = await api.api["study-plans"][":planId"].archive.$post({ param: { planId } })
  if (!res.ok) throw new Error("学習計画のアーカイブに失敗しました")
}

export const unarchiveStudyPlan = async (planId: string): Promise<void> => {
  const res = await api.api["study-plans"][":planId"].unarchive.$post({ param: { planId } })
  if (!res.ok) throw new Error("学習計画のアーカイブ解除に失敗しました")
}

export const duplicateStudyPlan = async (planId: string): Promise<{ plan: StudyPlanResponse }> => {
  const res = await api.api["study-plans"][":planId"].duplicate.$post({ param: { planId } })
  if (!res.ok) throw new Error("学習計画の複製に失敗しました")
  const data = await res.json()
  return planWrapperSchema.parse(data)
}

export const addStudyPlanItem = async (planId: string, input: CreateStudyPlanItemRequest): Promise<{ item: StudyPlanItemResponse }> => {
  const res = await api.api["study-plans"][":planId"].items.$post({ param: { planId }, json: input })
  if (!res.ok) throw new Error("学習項目の追加に失敗しました")
  const data = await res.json()
  return itemWrapperSchema.parse(data)
}

export const updateStudyPlanItem = async (planId: string, itemId: string, input: UpdateStudyPlanItemRequest): Promise<{ item: StudyPlanItemResponse }> => {
  const res = await api.api["study-plans"][":planId"].items[":itemId"].$patch({ param: { planId, itemId }, json: input })
  if (!res.ok) throw new Error("学習項目の更新に失敗しました")
  const data = await res.json()
  return itemWrapperSchema.parse(data)
}

export const removeStudyPlanItem = async (planId: string, itemId: string): Promise<void> => {
  const res = await api.api["study-plans"][":planId"].items[":itemId"].$delete({ param: { planId, itemId } })
  if (!res.ok) throw new Error("学習項目の削除に失敗しました")
}

export const reorderStudyPlanItems = async (planId: string, itemIds: string[]): Promise<void> => {
  const res = await api.api["study-plans"][":planId"].items.reorder.$put({ param: { planId }, json: { itemIds } })
  if (!res.ok) throw new Error("学習項目の並び替えに失敗しました")
}

export const addStudyPlanRevision = async (planId: string, input: CreateStudyPlanRevisionRequest): Promise<{ revision: StudyPlanRevisionResponse }> => {
  const res = await api.api["study-plans"][":planId"].revisions.$post({ param: { planId }, json: input })
  if (!res.ok) throw new Error("復習の追加に失敗しました")
  const data = await res.json()
  return revisionWrapperSchema.parse(data)
}

export const updateStudyPlanRevision = async (planId: string, revisionId: string, input: UpdateStudyPlanRevisionRequest): Promise<{ revision: StudyPlanRevisionResponse }> => {
  const res = await api.api["study-plans"][":planId"].revisions[":revisionId"].$patch({ param: { planId, revisionId }, json: input })
  if (!res.ok) throw new Error("復習の更新に失敗しました")
  const data = await res.json()
  return revisionWrapperSchema.parse(data)
}
