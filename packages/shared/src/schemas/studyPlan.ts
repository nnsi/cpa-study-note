import { z } from "zod"

// スコープ
export const studyPlanScopeSchema = z.enum(["all", "subject", "topic_group"])
export type StudyPlanScope = z.infer<typeof studyPlanScopeSchema>

// レスポンス: 計画
export const studyPlanResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  intent: z.string().nullable(),
  scope: studyPlanScopeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
})
export type StudyPlanResponse = z.infer<typeof studyPlanResponseSchema>

// レスポンス: 計画要素
export const studyPlanItemResponseSchema = z.object({
  id: z.string(),
  studyPlanId: z.string(),
  topicId: z.string().nullable(),
  topicName: z.string().nullable(),
  description: z.string(),
  rationale: z.string().nullable(),
  orderIndex: z.number(),
  createdAt: z.string().datetime(),
})
export type StudyPlanItemResponse = z.infer<typeof studyPlanItemResponseSchema>

// レスポンス: 計画変遷
export const studyPlanRevisionResponseSchema = z.object({
  id: z.string(),
  studyPlanId: z.string(),
  summary: z.string(),
  reason: z.string(),
  createdAt: z.string().datetime(),
})
export type StudyPlanRevisionResponse = z.infer<typeof studyPlanRevisionResponseSchema>

// レスポンス: 計画詳細（要素 + 変遷込み）
export const studyPlanDetailResponseSchema = z.object({
  plan: studyPlanResponseSchema,
  items: z.array(studyPlanItemResponseSchema),
  revisions: z.array(studyPlanRevisionResponseSchema),
})
export type StudyPlanDetailResponse = z.infer<typeof studyPlanDetailResponseSchema>

// レスポンス: 計画一覧
export const studyPlanListResponseSchema = z.object({
  plans: z.array(
    studyPlanResponseSchema.extend({
      itemCount: z.number(),
    })
  ),
})
export type StudyPlanListResponse = z.infer<typeof studyPlanListResponseSchema>

// リクエスト: 計画作成
export const createStudyPlanRequestSchema = z.object({
  title: z.string().min(1).max(200),
  intent: z.string().max(2000).optional(),
  scope: studyPlanScopeSchema,
})
export type CreateStudyPlanRequest = z.infer<typeof createStudyPlanRequestSchema>

// リクエスト: 計画更新
export const updateStudyPlanRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  intent: z.string().max(2000).nullable().optional(),
})
export type UpdateStudyPlanRequest = z.infer<typeof updateStudyPlanRequestSchema>

// リクエスト: 計画要素追加
export const createStudyPlanItemRequestSchema = z.object({
  topicId: z.string().optional(),
  description: z.string().min(1).max(2000),
  rationale: z.string().max(2000).optional(),
  orderIndex: z.number().int().min(0),
})
export type CreateStudyPlanItemRequest = z.infer<typeof createStudyPlanItemRequestSchema>

// リクエスト: 計画要素更新
export const updateStudyPlanItemRequestSchema = z.object({
  description: z.string().min(1).max(2000).optional(),
  rationale: z.string().max(2000).nullable().optional(),
  topicId: z.string().nullable().optional(),
  orderIndex: z.number().int().min(0).optional(),
})
export type UpdateStudyPlanItemRequest = z.infer<typeof updateStudyPlanItemRequestSchema>

// リクエスト: 計画要素並べ替え
export const reorderStudyPlanItemsRequestSchema = z.object({
  itemIds: z.array(z.string()).min(1),
})
export type ReorderStudyPlanItemsRequest = z.infer<typeof reorderStudyPlanItemsRequestSchema>

// リクエスト: 計画変遷記録
export const createStudyPlanRevisionRequestSchema = z.object({
  summary: z.string().min(1).max(2000),
  reason: z.string().min(1).max(2000),
})
export type CreateStudyPlanRevisionRequest = z.infer<typeof createStudyPlanRevisionRequestSchema>

// パラメータ: 計画ID
export const studyPlanParamsSchema = z.object({
  planId: z.string(),
})

// パラメータ: 計画ID + 要素ID
export const studyPlanItemParamsSchema = z.object({
  planId: z.string(),
  itemId: z.string(),
})
