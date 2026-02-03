import { z } from "zod"
import { topicResponseSchema } from "../topic"
import { userTopicProgressSchema } from "../learning"

// TopicView: トピック詳細画面用の合成ビュー
export const topicViewSchema = z.object({
  topic: topicResponseSchema,
  progress: userTopicProgressSchema.nullable(),
  recentNotes: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().nullable(),
        updatedAt: z.string().datetime(),
      })
    )
    .optional(),
  recentSessions: z
    .array(
      z.object({
        id: z.string(),
        createdAt: z.string().datetime(),
      })
    )
    .optional(),
})

export type TopicView = z.infer<typeof topicViewSchema>

// SubjectDashboardView: 科目ダッシュボード用
export const subjectDashboardViewSchema = z.object({
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

export type SubjectDashboardView = z.infer<typeof subjectDashboardViewSchema>

// TopicReviewListView: レビュー一覧用
export const topicReviewListViewSchema = z.object({
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

export type TopicReviewListView = z.infer<typeof topicReviewListViewSchema>
