import { eq, and, sql, desc, gte, lte, gt } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  subjects,
  categories,
  topics,
  userTopicProgress,
  topicCheckHistory,
  chatSessions,
  chatMessages,
} from "@cpa-study/db/schema"

export type RecentTopicRow = {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  categoryId: string
  lastAccessedAt: Date
}

export type TopicRepository = {
  // Subjects
  findAllSubjects: () => Promise<Subject[]>
  findSubjectById: (id: string) => Promise<Subject | null>
  getSubjectStats: (subjectId: string) => Promise<SubjectStats>

  // Categories
  findCategoriesBySubjectId: (subjectId: string) => Promise<Category[]>
  findCategoryById: (id: string) => Promise<Category | null>
  getCategoryTopicCounts: (subjectId: string) => Promise<CategoryTopicCount[]>

  // Topics
  findTopicsByCategoryId: (categoryId: string) => Promise<Topic[]>
  findTopicById: (id: string) => Promise<Topic | null>

  // Progress
  findProgress: (userId: string, topicId: string) => Promise<TopicProgress | null>
  upsertProgress: (progress: UpsertProgress) => Promise<TopicProgress>
  findProgressByUser: (userId: string) => Promise<TopicProgress[]>
  getProgressCountsByCategory: (
    userId: string,
    subjectId: string
  ) => Promise<CategoryProgressCount[]>
  getProgressCountsBySubject: (userId: string) => Promise<SubjectProgressCount[]>
  findRecentTopics: (userId: string, limit: number) => Promise<RecentTopicRow[]>

  // Check History
  createCheckHistory: (history: CreateCheckHistory) => Promise<CheckHistoryRecord>
  findCheckHistoryByTopic: (
    userId: string,
    topicId: string
  ) => Promise<CheckHistoryRecord[]>

  // Filter
  findFilteredTopics: (
    userId: string,
    filters: TopicFilterParams
  ) => Promise<FilteredTopicRow[]>
}

type SubjectProgressCount = {
  subjectId: string
  understoodCount: number
}

type CategoryTopicCount = {
  categoryId: string
  topicCount: number
}

type CategoryProgressCount = {
  categoryId: string
  understoodCount: number
}

type Subject = {
  id: string
  name: string
  description: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

type SubjectStats = {
  categoryCount: number
  topicCount: number
}

type Category = {
  id: string
  subjectId: string
  name: string
  depth: number
  parentId: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

type Topic = {
  id: string
  categoryId: string
  name: string
  description: string | null
  difficulty: string | null
  topicType: string | null
  aiSystemPrompt: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

type TopicProgress = {
  id: string
  userId: string
  topicId: string
  understood: boolean
  lastAccessedAt: Date | null
  questionCount: number
  goodQuestionCount: number
  createdAt: Date
  updatedAt: Date
}

type UpsertProgress = {
  userId: string
  topicId: string
  understood?: boolean
  incrementQuestionCount?: boolean
  incrementGoodQuestionCount?: boolean
}

type CheckHistoryRecord = {
  id: string
  topicId: string
  userId: string
  action: "checked" | "unchecked"
  checkedAt: Date
}

type CreateCheckHistory = {
  userId: string
  topicId: string
  action: "checked" | "unchecked"
}

export type TopicFilterParams = {
  minSessionCount?: number
  daysSinceLastChat?: number
  understood?: boolean
  hasPostCheckChat?: boolean
  minGoodQuestionCount?: number
}

export type FilteredTopicRow = {
  id: string
  name: string
  categoryId: string
  subjectId: string
  subjectName: string
  sessionCount: number
  lastChatAt: Date | null
  understood: boolean
  goodQuestionCount: number
  lastCheckedAt: Date | null
}

export const createTopicRepository = (db: Db): TopicRepository => ({
  findAllSubjects: async () => {
    return db.select().from(subjects).orderBy(subjects.displayOrder)
  },

  findSubjectById: async (id) => {
    const result = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, id))
      .limit(1)
    return result[0] ?? null
  },

  getSubjectStats: async (subjectId) => {
    const categoryResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(eq(categories.subjectId, subjectId))

    const topicResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(eq(categories.subjectId, subjectId))

    return {
      categoryCount: categoryResult[0]?.count ?? 0,
      topicCount: topicResult[0]?.count ?? 0,
    }
  },

  findCategoriesBySubjectId: async (subjectId) => {
    return db
      .select()
      .from(categories)
      .where(eq(categories.subjectId, subjectId))
      .orderBy(categories.depth, categories.displayOrder)
  },

  findCategoryById: async (id) => {
    const result = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1)
    return result[0] ?? null
  },

  findTopicsByCategoryId: async (categoryId) => {
    return db
      .select()
      .from(topics)
      .where(eq(topics.categoryId, categoryId))
      .orderBy(topics.displayOrder)
  },

  findTopicById: async (id) => {
    const result = await db
      .select()
      .from(topics)
      .where(eq(topics.id, id))
      .limit(1)
    return result[0] ?? null
  },

  findProgress: async (userId, topicId) => {
    const result = await db
      .select()
      .from(userTopicProgress)
      .where(
        and(
          eq(userTopicProgress.userId, userId),
          eq(userTopicProgress.topicId, topicId)
        )
      )
      .limit(1)
    return result[0] ?? null
  },

  upsertProgress: async (progress) => {
    const existing = await db
      .select()
      .from(userTopicProgress)
      .where(
        and(
          eq(userTopicProgress.userId, progress.userId),
          eq(userTopicProgress.topicId, progress.topicId)
        )
      )
      .limit(1)

    const now = new Date()

    if (existing[0]) {
      const updates: Record<string, unknown> = {
        lastAccessedAt: now,
        updatedAt: now,
      }

      if (progress.understood !== undefined) {
        updates.understood = progress.understood
      }
      if (progress.incrementQuestionCount) {
        updates.questionCount = existing[0].questionCount + 1
      }
      if (progress.incrementGoodQuestionCount) {
        updates.goodQuestionCount = existing[0].goodQuestionCount + 1
      }

      await db
        .update(userTopicProgress)
        .set(updates)
        .where(eq(userTopicProgress.id, existing[0].id))

      return {
        ...existing[0],
        ...updates,
        lastAccessedAt: now,
        updatedAt: now,
      } as TopicProgress
    }

    const id = crypto.randomUUID()
    const newProgress = {
      id,
      userId: progress.userId,
      topicId: progress.topicId,
      understood: progress.understood ?? false,
      lastAccessedAt: now,
      questionCount: progress.incrementQuestionCount ? 1 : 0,
      goodQuestionCount: progress.incrementGoodQuestionCount ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(userTopicProgress).values(newProgress)

    return newProgress
  },

  findProgressByUser: async (userId) => {
    return db
      .select()
      .from(userTopicProgress)
      .where(eq(userTopicProgress.userId, userId))
  },

  getCategoryTopicCounts: async (subjectId) => {
    const result = await db
      .select({
        categoryId: topics.categoryId,
        topicCount: sql<number>`count(*)`,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(eq(categories.subjectId, subjectId))
      .groupBy(topics.categoryId)

    return result
  },

  getProgressCountsByCategory: async (userId, subjectId) => {
    const result = await db
      .select({
        categoryId: topics.categoryId,
        understoodCount: sql<number>`sum(case when ${userTopicProgress.understood} = 1 then 1 else 0 end)`,
      })
      .from(userTopicProgress)
      .innerJoin(topics, eq(userTopicProgress.topicId, topics.id))
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(
        and(
          eq(userTopicProgress.userId, userId),
          eq(categories.subjectId, subjectId)
        )
      )
      .groupBy(topics.categoryId)

    return result
  },

  getProgressCountsBySubject: async (userId) => {
    const result = await db
      .select({
        subjectId: categories.subjectId,
        understoodCount: sql<number>`sum(case when ${userTopicProgress.understood} = 1 then 1 else 0 end)`,
      })
      .from(userTopicProgress)
      .innerJoin(topics, eq(userTopicProgress.topicId, topics.id))
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(eq(userTopicProgress.userId, userId))
      .groupBy(categories.subjectId)

    return result
  },

  findRecentTopics: async (userId, limit) => {
    const result = await db
      .select({
        topicId: topics.id,
        topicName: topics.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
        categoryId: categories.id,
        lastAccessedAt: userTopicProgress.lastAccessedAt,
      })
      .from(userTopicProgress)
      .innerJoin(topics, eq(userTopicProgress.topicId, topics.id))
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .where(
        and(
          eq(userTopicProgress.userId, userId),
          gt(userTopicProgress.lastAccessedAt, new Date(0))
        )
      )
      .orderBy(desc(userTopicProgress.lastAccessedAt))
      .limit(limit)

    return result.filter((r) => r.lastAccessedAt !== null) as {
      topicId: string
      topicName: string
      subjectId: string
      subjectName: string
      categoryId: string
      lastAccessedAt: Date
    }[]
  },

  createCheckHistory: async (history) => {
    const id = crypto.randomUUID()
    const now = new Date()

    const record = {
      id,
      topicId: history.topicId,
      userId: history.userId,
      action: history.action,
      checkedAt: now,
    }

    await db.insert(topicCheckHistory).values(record)

    return record
  },

  findCheckHistoryByTopic: async (userId, topicId) => {
    const result = await db
      .select()
      .from(topicCheckHistory)
      .where(
        and(
          eq(topicCheckHistory.userId, userId),
          eq(topicCheckHistory.topicId, topicId)
        )
      )
      .orderBy(desc(topicCheckHistory.checkedAt))

    return result
  },

  findFilteredTopics: async (userId, filters) => {
    // セッション数と最終チャット日時のサブクエリ
    // lastChatAt は最後のメッセージ送信時刻（事実ベースの思想に合致）
    const sessionStatsSubquery = db
      .select({
        topicId: chatSessions.topicId,
        sessionCount: sql<number>`count(distinct ${chatSessions.id})`.as("session_count"),
        lastChatAt: sql<Date | null>`max(${chatMessages.createdAt})`.as("last_chat_at"),
      })
      .from(chatSessions)
      .leftJoin(chatMessages, eq(chatSessions.id, chatMessages.sessionId))
      .where(eq(chatSessions.userId, userId))
      .groupBy(chatSessions.topicId)
      .as("session_stats")

    // 最終チェック日時のサブクエリ（action = 'checked' のもの）
    const lastCheckedSubquery = db
      .select({
        topicId: topicCheckHistory.topicId,
        lastCheckedAt: sql<Date | null>`max(${topicCheckHistory.checkedAt})`.as("last_checked_at"),
      })
      .from(topicCheckHistory)
      .where(
        and(
          eq(topicCheckHistory.userId, userId),
          eq(topicCheckHistory.action, "checked")
        )
      )
      .groupBy(topicCheckHistory.topicId)
      .as("last_checked")

    // goodQuestion の集計サブクエリ
    const goodQuestionSubquery = db
      .select({
        topicId: chatSessions.topicId,
        chatGoodQuestionCount: sql<number>`count(case when ${chatMessages.questionQuality} = 'good' then 1 end)`.as("chat_good_question_count"),
      })
      .from(chatSessions)
      .innerJoin(chatMessages, eq(chatSessions.id, chatMessages.sessionId))
      .where(eq(chatSessions.userId, userId))
      .groupBy(chatSessions.topicId)
      .as("good_questions")

    // メインクエリ
    const baseQuery = db
      .select({
        id: topics.id,
        name: topics.name,
        categoryId: topics.categoryId,
        subjectId: categories.subjectId,
        subjectName: subjects.name,
        sessionCount: sql<number>`coalesce(${sessionStatsSubquery.sessionCount}, 0)`,
        lastChatAt: sessionStatsSubquery.lastChatAt,
        understood: sql<boolean>`coalesce(${userTopicProgress.understood}, 0)`,
        goodQuestionCount: sql<number>`coalesce(${goodQuestionSubquery.chatGoodQuestionCount}, 0)`,
        lastCheckedAt: lastCheckedSubquery.lastCheckedAt,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .leftJoin(
        userTopicProgress,
        and(
          eq(userTopicProgress.topicId, topics.id),
          eq(userTopicProgress.userId, userId)
        )
      )
      .leftJoin(sessionStatsSubquery, eq(sessionStatsSubquery.topicId, topics.id))
      .leftJoin(goodQuestionSubquery, eq(goodQuestionSubquery.topicId, topics.id))
      .leftJoin(lastCheckedSubquery, eq(lastCheckedSubquery.topicId, topics.id))

    // 結果を取得
    const results = await baseQuery

    // アプリケーションレベルでフィルタリング
    return results.filter((row) => {
      // minSessionCount フィルタ
      if (
        filters.minSessionCount !== undefined &&
        row.sessionCount < filters.minSessionCount
      ) {
        return false
      }

      // daysSinceLastChat フィルタ
      if (filters.daysSinceLastChat !== undefined && row.lastChatAt) {
        const daysSince = Math.floor(
          (Date.now() - new Date(row.lastChatAt).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSince < filters.daysSinceLastChat) {
          return false
        }
      }

      // daysSinceLastChat フィルタ: チャットがない場合はスキップ（チャットが必要）
      if (filters.daysSinceLastChat !== undefined && !row.lastChatAt) {
        return false
      }

      // understood フィルタ
      if (filters.understood !== undefined) {
        const isUnderstood = Boolean(row.understood)
        if (isUnderstood !== filters.understood) {
          return false
        }
      }

      // hasPostCheckChat フィルタ: チェック後にチャットがあるか
      if (filters.hasPostCheckChat !== undefined) {
        const hasChat =
          row.lastCheckedAt &&
          row.lastChatAt &&
          new Date(row.lastChatAt) > new Date(row.lastCheckedAt)

        if (filters.hasPostCheckChat && !hasChat) {
          return false
        }
        if (!filters.hasPostCheckChat && hasChat) {
          return false
        }
      }

      // minGoodQuestionCount フィルタ
      if (
        filters.minGoodQuestionCount !== undefined &&
        row.goodQuestionCount < filters.minGoodQuestionCount
      ) {
        return false
      }

      return true
    })
  },
})
