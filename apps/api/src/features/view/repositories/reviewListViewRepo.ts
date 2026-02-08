import { eq, and, isNull, sql, or, gte, desc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  topics,
  categories,
  subjects,
  studyDomains,
  userTopicProgress,
  chatSessions,
} from "@cpa-study/db/schema"

export type ReviewListFilters = {
  understood?: boolean
  daysSince?: number
  limit?: number
}

export type ReviewListData = {
  topics: Array<{
    id: string
    name: string
    subjectId: string
    subjectName: string
    categoryId: string
    understood: boolean
    lastAccessedAt: Date | null
    sessionCount: number
  }>
  total: number
}

export type ReviewListViewRepo = {
  getReviewList: (userId: string, filters?: ReviewListFilters) => Promise<ReviewListData>
}

export const createReviewListViewRepo = (db: Db): ReviewListViewRepo => ({
  getReviewList: async (userId, filters = {}) => {
    const { understood, daysSince, limit = 50 } = filters

    // Session count subquery
    const sessionCountSubquery = db
      .select({
        topicId: chatSessions.topicId,
        sessionCount: sql<number>`count(*)`.as("session_count"),
      })
      .from(chatSessions)
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

    // Filter by days since last access
    if (daysSince !== undefined && daysSince > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysSince)
      conditions.push(
        or(
          isNull(userTopicProgress.lastAccessedAt),
          gte(userTopicProgress.lastAccessedAt, cutoffDate)
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
      .where(and(...conditions))

    const total = countResult[0]?.count ?? 0

    // Get topics with stats
    const topicsResult = await db
      .select({
        id: topics.id,
        name: topics.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
        categoryId: categories.id,
        understood: sql<boolean>`coalesce(${userTopicProgress.understood}, false)`,
        lastAccessedAt: userTopicProgress.lastAccessedAt,
        sessionCount: sql<number>`coalesce(${sessionCountSubquery.sessionCount}, 0)`,
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
