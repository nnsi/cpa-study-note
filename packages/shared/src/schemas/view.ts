import { z } from "zod"

// ========== クエリスキーマ ==========

// Review list query
export const reviewListQuerySchema = z.object({
  understood: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  daysSince: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>

// Search query
export const searchQuerySchema = z.object({
  q: z.string().min(1),
  studyDomainId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>

// ========== レスポンススキーマ ==========

// TopicView: トピック詳細画面用
export const topicViewResponseSchema = z.object({
  topic: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    categoryId: z.string(),
    categoryName: z.string(),
    subjectId: z.string(),
    subjectName: z.string(),
    difficulty: z.string().nullable(),
    topicType: z.string().nullable(),
    displayOrder: z.number(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
  progress: z
    .object({
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
    .nullable(),
  recentNotes: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      updatedAt: z.string().datetime(),
    })
  ),
  recentSessions: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
})

export type TopicViewResponse = z.infer<typeof topicViewResponseSchema>

// SubjectDashboardView: 科目ダッシュボード用
export const subjectDashboardResponseSchema = z.object({
  subject: z.object({
    id: z.string(),
    name: z.string(),
    emoji: z.string().nullable(),
    color: z.string().nullable(),
  }),
  stats: z.object({
    categoryCount: z.number(),
    topicCount: z.number(),
    completedCount: z.number(),
    progressPercentage: z.number(),
  }),
  recentTopics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      lastAccessedAt: z.string().datetime().nullable(),
    })
  ),
})

export type SubjectDashboardResponse = z.infer<typeof subjectDashboardResponseSchema>

// ReviewListView: レビュー一覧用
export const reviewListResponseSchema = z.object({
  topics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      subjectId: z.string(),
      subjectName: z.string(),
      categoryId: z.string(),
      understood: z.boolean(),
      lastAccessedAt: z.string().datetime().nullable(),
      sessionCount: z.number(),
    })
  ),
  total: z.number(),
})

export type ReviewListResponse = z.infer<typeof reviewListResponseSchema>

// CategoryTopicsView: カテゴリ配下の論点一覧
export const categoryTopicsResponseSchema = z.object({
  category: z.object({
    id: z.string(),
    name: z.string(),
  }),
  topics: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      displayOrder: z.number(),
    })
  ),
})

export type CategoryTopicsResponse = z.infer<typeof categoryTopicsResponseSchema>

// SearchTopicsView: 論点検索結果
// viewの検索結果（topicのTopicSearchResultとは別スキーマ - descriptionやstudyDomainIdを含まない）
export const viewTopicSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
})

export type ViewTopicSearchResult = z.infer<typeof viewTopicSearchResultSchema>

export const searchTopicsResponseSchema = z.object({
  results: z.array(viewTopicSearchResultSchema),
  total: z.number(),
})

export type SearchTopicsResponse = z.infer<typeof searchTopicsResponseSchema>
