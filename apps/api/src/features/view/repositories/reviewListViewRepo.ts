import { eq, and, isNull, sql, or, desc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { traced, type Tracer } from "@/shared/lib/tracer"
import {
  topics,
  categories,
  subjects,
  studyDomains,
  userTopicProgress,
  chatSessions,
  chatMessages,
} from "@cpa-study/db/schema"

export type ReviewListFilters = {
  understood?: boolean
  daysSince?: number
  minSessionCount?: number
  minGoodQuestionCount?: number
  limit?: number
}

export type ReviewListData = {
  topics: Array<{
    id: string
    name: string
    studyDomainId: string
    subjectId: string
    subjectName: string
    categoryId: string
    understood: boolean
    lastAccessedAt: Date | null
    lastChatAt: Date | null
    sessionCount: number
    goodQuestionCount: number
  }>
  total: number
}

export type ReviewListViewRepository = {
  getReviewList: (userId: string, filters?: ReviewListFilters) => Promise<ReviewListData>
}

export const tracedReviewListViewRepo = (repo: ReviewListViewRepository, tracer: Tracer): ReviewListViewRepository => ({
  getReviewList: traced(tracer, "d1.getReviewList", repo.getReviewList),
})

export const createReviewListViewRepository = (db: Db): ReviewListViewRepository => ({
  getReviewList: async (userId, filters = {}) => {
    const { understood, daysSince, minSessionCount, minGoodQuestionCount, limit = 50 } = filters

    // Session count subquery
    const sessionCountSubquery = db
      .select({
        topicId: chatSessions.topicId,
        sessionCount: sql<number>`count(distinct ${chatSessions.id})`.as("session_count"),
        lastChatAt: sql<Date | null>`max(${chatMessages.createdAt})`
          .mapWith(chatMessages.createdAt)
          .as("last_chat_at"),
      })
      .from(chatSessions)
      .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
      .where(eq(chatSessions.userId, userId))
      .groupBy(chatSessions.topicId)
      .as("session_stats")

    // Build conditions (userId + deleted_at check is mandatory)
    const conditions = [
      eq(topics.userId, userId),
      isNull(topics.deletedAt),
      isNull(categories.deletedAt),
      isNull(subjects.deletedAt),
      isNull(studyDomains.deletedAt),
    ]

    // Filter by understood status
    if (understood !== undefined) {
      if (understood) {
        conditions.push(eq(userTopicProgress.understood, true))
      } else {
        conditions.push(
          or(
            isNull(userTopicProgress.understood),
            eq(userTopicProgress.understood, false)
          ) ?? sql`1=1`
        )
      }
    }

    if (minSessionCount !== undefined && minSessionCount > 0) {
      conditions.push(sql`coalesce(${sessionCountSubquery.sessionCount}, 0) >= ${minSessionCount}`)
    }

    if (minGoodQuestionCount !== undefined && minGoodQuestionCount > 0) {
      conditions.push(sql`coalesce(${userTopicProgress.goodQuestionCount}, 0) >= ${minGoodQuestionCount}`)
    }

    // Filter by days since last access
    if (daysSince !== undefined && daysSince > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysSince)
      conditions.push(
        or(
          isNull(sessionCountSubquery.lastChatAt),
          // 集約列はDate用のエンコーダを保持しないため、SQLiteのtimestamp
          // 格納形式（Unix秒）に揃えて比較する。
          sql`${sessionCountSubquery.lastChatAt} <= ${Math.floor(cutoffDate.getTime() / 1000)}`
        ) ?? sql`1=1`
      )
    }

    // Get total count first
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .leftJoin(
        userTopicProgress,
        and(
          eq(userTopicProgress.topicId, topics.id),
          eq(userTopicProgress.userId, userId)
        )
      )
      .leftJoin(sessionCountSubquery, eq(topics.id, sessionCountSubquery.topicId))
      .where(and(...conditions))

    const total = countResult[0]?.count ?? 0

    // Get topics with stats
    const topicsResult = await db
      .select({
        id: topics.id,
        name: topics.name,
        studyDomainId: studyDomains.id,
        subjectId: subjects.id,
        subjectName: subjects.name,
        categoryId: categories.id,
        understood: sql<boolean>`coalesce(${userTopicProgress.understood}, false)`,
        lastAccessedAt: userTopicProgress.lastAccessedAt,
        lastChatAt: sessionCountSubquery.lastChatAt,
        sessionCount: sql<number>`coalesce(${sessionCountSubquery.sessionCount}, 0)`,
        goodQuestionCount: sql<number>`coalesce(${userTopicProgress.goodQuestionCount}, 0)`,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .leftJoin(
        userTopicProgress,
        and(
          eq(userTopicProgress.topicId, topics.id),
          eq(userTopicProgress.userId, userId)
        )
      )
      .leftJoin(sessionCountSubquery, eq(topics.id, sessionCountSubquery.topicId))
      .where(and(...conditions))
      .orderBy(desc(userTopicProgress.lastAccessedAt))
      .limit(limit)

    return {
      topics: topicsResult.map((t) => ({
        ...t,
        understood: Boolean(t.understood),
      })),
      total,
    }
  },
})
