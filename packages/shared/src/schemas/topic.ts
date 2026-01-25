import { z } from "zod"

export const difficultySchema = z.enum(["basic", "intermediate", "advanced"])
export type Difficulty = z.infer<typeof difficultySchema>

export const topicTypeSchema = z.enum(["theory", "calculation", "mixed"])
export type TopicType = z.infer<typeof topicTypeSchema>

export const subjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Subject = z.infer<typeof subjectSchema>

export const categorySchema = z.object({
  id: z.string(),
  subjectId: z.string(),
  name: z.string(),
  depth: z.number(),
  parentId: z.string().nullable(),
  displayOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Category = z.infer<typeof categorySchema>

export const topicSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  difficulty: difficultySchema.nullable(),
  topicType: topicTypeSchema.nullable(),
  aiSystemPrompt: z.string().nullable(),
  displayOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

// Response schemas with nested data
export const subjectWithStatsSchema = subjectSchema.extend({
  categoryCount: z.number(),
  topicCount: z.number(),
  completedCount: z.number().optional(),
})

export type SubjectWithStats = z.infer<typeof subjectWithStatsSchema>

// 再帰型は先に定義
export type CategoryWithChildren = Category & {
  children?: CategoryWithChildren[]
  topics?: Topic[]
}

export const categoryWithChildrenSchema: z.ZodType<CategoryWithChildren> = categorySchema.extend({
  children: z.array(z.lazy(() => categoryWithChildrenSchema)).optional(),
  topics: z.array(topicSchema).optional(),
})

export const topicWithProgressSchema = topicSchema.extend({
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
