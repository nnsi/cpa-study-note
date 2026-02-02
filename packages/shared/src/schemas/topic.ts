import { z } from "zod"

export const difficultySchema = z.enum(["basic", "intermediate", "advanced"])
export type Difficulty = z.infer<typeof difficultySchema>

export const topicTypeSchema = z.enum(["theory", "calculation", "mixed"])
export type TopicType = z.infer<typeof topicTypeSchema>

export const subjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  studyDomainId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  emoji: z.string().nullable(),
  color: z.string().nullable(),
  displayOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
})

export type Subject = z.infer<typeof subjectSchema>

export const categorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  subjectId: z.string(),
  name: z.string(),
  depth: z.number(),
  parentId: z.string().nullable(),
  displayOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
})

export type Category = z.infer<typeof categorySchema>

export const topicSchema = z.object({
  id: z.string(),
  userId: z.string(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  difficulty: difficultySchema.nullable(),
  topicType: topicTypeSchema.nullable(),
  aiSystemPrompt: z.string().nullable(),
  displayOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
})

export type Topic = z.infer<typeof topicSchema>

export const userTopicProgressSchema = z.object({
  id: z.string(),
  userId: z.string(),
  topicId: z.string(),
  understood: z.boolean(),
  lastAccessedAt: z.string().datetime().nullable(),
  questionCount: z.number(),
  goodQuestionCount: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type UserTopicProgress = z.infer<typeof userTopicProgressSchema>

// Response schemas - omit deletedAt for API responses
export const subjectResponseSchema = subjectSchema.omit({ deletedAt: true })
export type SubjectResponse = z.infer<typeof subjectResponseSchema>

export const categoryResponseSchema = categorySchema.omit({ deletedAt: true })
export type CategoryResponse = z.infer<typeof categoryResponseSchema>

export const topicResponseSchema = topicSchema.omit({ deletedAt: true })
export type TopicResponse = z.infer<typeof topicResponseSchema>

// Response schemas with nested data
export const subjectWithStatsSchema = subjectResponseSchema.extend({
  categoryCount: z.number(),
  topicCount: z.number(),
  completedCount: z.number().optional(),
})

export type SubjectWithStats = z.infer<typeof subjectWithStatsSchema>

// Type for recursive structure
export type CategoryWithChildren = CategoryResponse & {
  children?: CategoryWithChildren[]
  topics?: TopicResponse[]
}

export const categoryWithChildrenSchema: z.ZodType<CategoryWithChildren> = categoryResponseSchema.extend({
  children: z.array(z.lazy(() => categoryWithChildrenSchema)).optional(),
  topics: z.array(topicResponseSchema).optional(),
})

export const topicWithProgressSchema = topicResponseSchema.extend({
  progress: userTopicProgressSchema.nullable(),
})

export type TopicWithProgress = z.infer<typeof topicWithProgressSchema>

// TopicCheckHistory schemas
export const checkActionSchema = z.enum(["checked", "unchecked"])
export type CheckAction = z.infer<typeof checkActionSchema>

export const topicCheckHistorySchema = z.object({
  id: z.string(),
  topicId: z.string(),
  userId: z.string(),
  action: checkActionSchema,
  checkedAt: z.string().datetime(),
})

export type TopicCheckHistory = z.infer<typeof topicCheckHistorySchema>

// Response schema for check history API
export const topicCheckHistoryResponseSchema = z.object({
  id: z.string(),
  action: checkActionSchema,
  checkedAt: z.string().datetime(),
})

export type TopicCheckHistoryResponse = z.infer<typeof topicCheckHistoryResponseSchema>

// Filter schemas
export const topicFilterRequestSchema = z.object({
  minSessionCount: z.coerce.number().int().min(0).optional(),
  daysSinceLastChat: z.coerce.number().int().min(0).optional(),
  understood: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  hasPostCheckChat: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  minGoodQuestionCount: z.coerce.number().int().min(0).optional(),
})

export type TopicFilterRequest = z.input<typeof topicFilterRequestSchema>

// フロントエンド向けのフィルタパラメータ（booleanを直接使用）
export const topicFilterParamsSchema = z.object({
  minSessionCount: z.number().int().min(0).optional(),
  daysSinceLastChat: z.number().int().min(0).optional(),
  understood: z.boolean().optional(),
  hasPostCheckChat: z.boolean().optional(),
  minGoodQuestionCount: z.number().int().min(0).optional(),
})

export type TopicFilterParams = z.infer<typeof topicFilterParamsSchema>

export const filteredTopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  sessionCount: z.number(),
  lastChatAt: z.string().datetime().nullable(),
  understood: z.boolean(),
  goodQuestionCount: z.number(),
})

export type FilteredTopic = z.infer<typeof filteredTopicSchema>

export const topicFilterResponseSchema = z.object({
  topics: z.array(filteredTopicSchema),
})

export type TopicFilterResponse = z.infer<typeof topicFilterResponseSchema>

// Create/Update request schemas
export const createSubjectRequestSchema = z.object({
  name: z.string().min(1, "名前は必須です").max(200, "名前は200文字以内で入力してください"),
  description: z.string().max(1000).optional(),
  emoji: z.string().max(10).optional(),
  color: z.string().max(50).optional(),
})

export type CreateSubjectRequest = z.infer<typeof createSubjectRequestSchema>

export const updateSubjectRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
})

export type UpdateSubjectRequest = z.infer<typeof updateSubjectRequestSchema>

// Search schemas
export const topicSearchRequestSchema = z.object({
  q: z.string().min(1, "検索キーワードは必須です").max(100, "検索キーワードは100文字以内"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  studyDomainId: z.string().optional(),
})

export type TopicSearchRequest = z.input<typeof topicSearchRequestSchema>

export const topicSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  categoryId: z.string(),
  categoryName: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  studyDomainId: z.string(),
})

export type TopicSearchResult = z.infer<typeof topicSearchResultSchema>

export const topicSearchResponseSchema = z.object({
  results: z.array(topicSearchResultSchema),
  total: z.number(),
})

export type TopicSearchResponse = z.infer<typeof topicSearchResponseSchema>

// Progress update request schema
export const updateProgressRequestSchema = z.object({
  understood: z.boolean().optional(),
})

export type UpdateProgressRequest = z.infer<typeof updateProgressRequestSchema>

// Subject list query schema
export const listSubjectsQuerySchema = z.object({
  studyDomainId: z.string().optional(),
})

export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>
