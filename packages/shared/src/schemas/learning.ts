import { z } from "zod"

// Re-export from topic.ts for backward compatibility
export { updateProgressRequestSchema, type UpdateProgressRequest } from "./topic"
export { userTopicProgressSchema, type UserTopicProgress } from "./topic"

// Recent topics query
export const recentTopicsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
})

export type RecentTopicsQuery = z.infer<typeof recentTopicsQuerySchema>

// 進捗レスポンス（APIレスポンス形式 - idなし）
export const progressResponseSchema = z.object({
  userId: z.string(),
  topicId: z.string(),
  understood: z.boolean(),
  lastAccessedAt: z.string().datetime().nullable(),
  questionCount: z.number(),
  goodQuestionCount: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ProgressResponse = z.infer<typeof progressResponseSchema>

// ユーザー進捗一覧レスポンス
export const userProgressListResponseSchema = z.object({
  progress: z.array(progressResponseSchema),
})

export type UserProgressListResponse = z.infer<typeof userProgressListResponseSchema>

// 科目別進捗統計
export const subjectProgressStatsSchema = z.object({
  subjectId: z.string(),
  subjectName: z.string(),
  totalTopics: z.number(),
  understoodTopics: z.number(),
})

export type SubjectProgressStats = z.infer<typeof subjectProgressStatsSchema>

// 科目別進捗統計一覧レスポンス
export const subjectProgressStatsListResponseSchema = z.object({
  stats: z.array(subjectProgressStatsSchema),
})

export type SubjectProgressStatsListResponse = z.infer<typeof subjectProgressStatsListResponseSchema>
