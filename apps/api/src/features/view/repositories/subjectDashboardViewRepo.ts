import { eq, and, isNull, sql, desc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  subjects,
  studyDomains,
  categories,
  topics,
  userTopicProgress,
} from "@cpa-study/db/schema"

export type SubjectDashboardData = {
  subject: {
    id: string
    name: string
    emoji: string | null
    color: string | null
  }
  stats: {
    categoryCount: number
    topicCount: number
    completedCount: number
    progressPercentage: number
  }
  recentTopics: Array<{
    id: string
    name: string
    lastAccessedAt: Date | null
  }>
}

export type SubjectDashboardViewRepository = {
  getSubjectDashboard: (subjectId: string, userId: string) => Promise<SubjectDashboardData | null>
}

export const createSubjectDashboardViewRepository = (db: Db): SubjectDashboardViewRepository => ({
  getSubjectDashboard: async (subjectId, userId) => {
    // 1. Get subject (userId + deleted_at check)
    const subjectResult = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        emoji: subjects.emoji,
        color: subjects.color,
      })
      .from(subjects)
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(subjects.id, subjectId),
          eq(subjects.userId, userId),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)

    const subject = subjectResult[0]
    if (!subject) {
      return null
    }

    // 2. Get category count
    const categoryCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(
        and(
          eq(categories.subjectId, subjectId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt)
        )
      )

    const categoryCount = categoryCountResult[0]?.count ?? 0

    // 3. Get topic count
    const topicCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(
        and(
          eq(categories.subjectId, subjectId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt)
        )
      )

    const topicCount = topicCountResult[0]?.count ?? 0

    // 4. Get completed (understood) count
    const completedCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userTopicProgress)
      .innerJoin(topics, eq(userTopicProgress.topicId, topics.id))
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(
        and(
          eq(categories.subjectId, subjectId),
          eq(userTopicProgress.userId, userId),
          eq(userTopicProgress.understood, true),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt)
        )
      )

    const completedCount = completedCountResult[0]?.count ?? 0

    // 5. Calculate progress percentage
    const progressPercentage = topicCount > 0 ? Math.round((completedCount / topicCount) * 100) : 0

    // 6. Get recent topics (最新5件, lastAccessedAt based)
    const recentTopics = await db
      .select({
        id: topics.id,
        name: topics.name,
        lastAccessedAt: userTopicProgress.lastAccessedAt,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .leftJoin(
        userTopicProgress,
        and(
          eq(userTopicProgress.topicId, topics.id),
          eq(userTopicProgress.userId, userId)
        )
      )
      .where(
        and(
          eq(categories.subjectId, subjectId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt)
        )
      )
      .orderBy(desc(userTopicProgress.lastAccessedAt))
      .limit(5)

    return {
      subject,
      stats: {
        categoryCount,
        topicCount,
        completedCount,
        progressPercentage,
      },
      recentTopics,
    }
  },
})
