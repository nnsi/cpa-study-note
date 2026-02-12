import type { StudyPlanRepository, StudyPlan, StudyPlanItem, StudyPlanRevision, StudyPlanWithItemCount } from "./repository"
import type { StudyPlanResponse, StudyPlanItemResponse, StudyPlanRevisionResponse, StudyPlanScope } from "@cpa-study/shared/schemas"
import type { Logger } from "@/shared/lib/logger"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, type AppError } from "@/shared/lib/errors"

export type StudyPlanDeps = {
  repo: StudyPlanRepository
  logger: Logger
}

// Helper to convert DB plan to response format
const toPlanResponse = (plan: StudyPlan): StudyPlanResponse => ({
  id: plan.id,
  userId: plan.userId,
  title: plan.title,
  intent: plan.intent,
  scope: plan.scope,
  subjectId: plan.subjectId,
  subjectName: plan.subjectName,
  createdAt: plan.createdAt.toISOString(),
  updatedAt: plan.updatedAt.toISOString(),
  archivedAt: plan.archivedAt?.toISOString() ?? null,
})

const toItemResponse = (item: StudyPlanItem): StudyPlanItemResponse => ({
  id: item.id,
  studyPlanId: item.studyPlanId,
  topicId: item.topicId,
  topicName: item.topicName,
  description: item.description,
  rationale: item.rationale,
  orderIndex: item.orderIndex,
  createdAt: item.createdAt.toISOString(),
})

const toRevisionResponse = (revision: StudyPlanRevision): StudyPlanRevisionResponse => ({
  id: revision.id,
  studyPlanId: revision.studyPlanId,
  summary: revision.summary,
  reason: revision.reason,
  createdAt: revision.createdAt.toISOString(),
})

// Check plan ownership helper
const checkOwnership = async (
  deps: StudyPlanDeps,
  planId: string,
  userId: string
): Promise<Result<void, AppError>> => {
  const owned = await deps.repo.isPlanOwnedByUser(planId, userId)
  if (!owned) return err(notFound("計画が見つかりません"))
  return ok(undefined)
}

// 計画一覧
export const listPlans = async (
  deps: StudyPlanDeps,
  userId: string,
  filter?: { archived?: boolean }
): Promise<Result<(StudyPlanResponse & { itemCount: number })[], AppError>> => {
  const plans = await deps.repo.findPlansByUser(userId, filter)
  return ok(plans.map((p) => ({ ...toPlanResponse(p), itemCount: p.itemCount })))
}

// 計画詳細
export const getPlanDetail = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string
): Promise<Result<{ plan: StudyPlanResponse; items: StudyPlanItemResponse[]; revisions: StudyPlanRevisionResponse[] }, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const plan = await deps.repo.findPlanById(planId)
  if (!plan) return err(notFound("計画が見つかりません"))

  const items = await deps.repo.findItemsByPlan(planId)
  const revisions = await deps.repo.findRevisionsByPlan(planId)

  return ok({
    plan: toPlanResponse(plan),
    items: items.map(toItemResponse),
    revisions: revisions.map(toRevisionResponse),
  })
}

// 計画作成
export const createPlan = async (
  deps: StudyPlanDeps,
  userId: string,
  input: { title: string; intent?: string; scope: StudyPlanScope; subjectId?: string }
): Promise<Result<StudyPlanResponse, AppError>> => {
  const plan = await deps.repo.createPlan({
    id: crypto.randomUUID(),
    userId,
    title: input.title,
    intent: input.intent,
    scope: input.scope,
    subjectId: input.subjectId,
    now: new Date(),
  })
  return ok(toPlanResponse(plan))
}

// 計画更新
export const updatePlan = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string,
  input: { title?: string; intent?: string | null; subjectId?: string | null }
): Promise<Result<StudyPlanResponse, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const plan = await deps.repo.updatePlan(planId, input)
  if (!plan) return err(notFound("計画が見つかりません"))
  return ok(toPlanResponse(plan))
}

// 計画アーカイブ
export const archivePlan = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string
): Promise<Result<void, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const success = await deps.repo.archivePlan(planId)
  if (!success) return err(notFound("計画が見つかりません"))
  return ok(undefined)
}

// 計画アーカイブ解除
export const unarchivePlan = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string
): Promise<Result<void, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const success = await deps.repo.unarchivePlan(planId)
  if (!success) return err(notFound("計画が見つかりません"))
  return ok(undefined)
}

// 計画複製
export const duplicatePlan = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string
): Promise<Result<StudyPlanResponse, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const newPlan = await deps.repo.duplicatePlan(planId, crypto.randomUUID(), userId)
  if (!newPlan) return err(notFound("計画が見つかりません"))
  return ok(toPlanResponse(newPlan))
}

// 要素追加
export const addItem = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string,
  input: { topicId?: string; description: string; rationale?: string; orderIndex: number }
): Promise<Result<StudyPlanItemResponse, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const item = await deps.repo.createItem({
    id: crypto.randomUUID(),
    studyPlanId: planId,
    topicId: input.topicId,
    description: input.description,
    rationale: input.rationale,
    orderIndex: input.orderIndex,
    now: new Date(),
  })
  return ok(toItemResponse(item))
}

// 要素更新
export const updateItem = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string,
  itemId: string,
  input: { description?: string; rationale?: string | null; topicId?: string | null; orderIndex?: number }
): Promise<Result<StudyPlanItemResponse, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const item = await deps.repo.updateItem(itemId, input)
  if (!item) return err(notFound("計画要素が見つかりません"))
  return ok(toItemResponse(item))
}

// 要素削除（自動で変遷を記録）
export const removeItem = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string,
  itemId: string
): Promise<Result<void, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  // 削除前にアイテム情報を取得（変遷の summary 用）
  const item = await deps.repo.findItemById(itemId)
  if (!item) return err(notFound("計画要素が見つかりません"))

  const success = await deps.repo.deleteItem(itemId)
  if (!success) return err(notFound("計画要素が見つかりません"))

  // 変遷を自動記録
  await deps.repo.createRevision({
    id: crypto.randomUUID(),
    studyPlanId: planId,
    summary: `「${item.description}」を削除`,
    now: new Date(),
  })

  return ok(undefined)
}

// 要素並べ替え
export const reorderItems = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string,
  itemIds: string[]
): Promise<Result<void, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  await deps.repo.reorderItems(planId, itemIds)
  return ok(undefined)
}

// 変遷記録追加
export const addRevision = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string,
  input: { summary: string; reason?: string }
): Promise<Result<StudyPlanRevisionResponse, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const revision = await deps.repo.createRevision({
    id: crypto.randomUUID(),
    studyPlanId: planId,
    summary: input.summary,
    reason: input.reason,
    now: new Date(),
  })
  return ok(toRevisionResponse(revision))
}

// 変遷更新（理由追記用）
export const updateRevision = async (
  deps: StudyPlanDeps,
  userId: string,
  planId: string,
  revisionId: string,
  input: { reason?: string | null }
): Promise<Result<StudyPlanRevisionResponse, AppError>> => {
  const ownershipCheck = await checkOwnership(deps, planId, userId)
  if (!ownershipCheck.ok) return ownershipCheck

  const revision = await deps.repo.updateRevision(revisionId, input)
  if (!revision) return err(notFound("変遷記録が見つかりません"))
  return ok(toRevisionResponse(revision))
}
