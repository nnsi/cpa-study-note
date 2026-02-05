import { eq, and, isNull, desc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  topics,
  categories,
  subjects,
  studyDomains,
  userTopicProgress,
  topicCheckHistory,
} from "@cpa-study/db/schema"

// Progress-related types
export type TopicProgress = {
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

export type UpsertProgressInput = {
  userId: string
  topicId: string
  understood?: boolean
  incrementQuestionCount?: boolean
  incrementGoodQuestionCount?: boolean
}

export type CheckHistoryRecord = {
  id: string
  topicId: string
  userId: string
  action: "checked" | "unchecked"
  checkedAt: Date
}

export type CreateCheckHistoryInput = {
  userId: string
  topicId: string
  action: "checked" | "unchecked"
}

export type RecentTopicRow = {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  categoryId: string
  lastAccessedAt: Date
}

export type LearningRepository = {
  // Progress methods
  findProgress: (userId: string, topicId: string) => Promise<TopicProgress | null>
  upsertProgress: (userId: string, progress: UpsertProgressInput) => Promise<TopicProgress>
  findProgressByUser: (userId: string) => Promise<TopicProgress[]>
  findRecentTopics: (userId: string, limit: number) => Promise<RecentTopicRow[]>
  touchTopic: (userId: string, topicId: string) => Promise<TopicProgress>

  // Check History methods
  createCheckHistory: (userId: string, history: CreateCheckHistoryInput) => Promise<CheckHistoryRecord>
  findCheckHistoryByTopic: (userId: string, topicId: string) => Promise<CheckHistoryRecord[]>

  // Validation methods
  verifyTopicExists: (userId: string, topicId: string) => Promise<boolean>
}

export const createLearningRepository = (db: Db): LearningRepository => ({
  findProgress: async (userId, topicId) => {
    const result = await db
      .select()
      .from(userTopicProgress)
      .where(and(eq(userTopicProgress.userId, userId), eq(userTopicProgress.topicId, topicId)))
      .limit(1)
    return result[0] ?? null
  },

  upsertProgress: async (userId, progress) => {
    const existing = await db
      .select()
      .from(userTopicProgress)
      .where(and(eq(userTopicProgress.userId, userId), eq(userTopicProgress.topicId, progress.topicId)))
      .limit(1)

    const now = new Date()

    if (existing[0]) {
      const updates: Record<string, unknown> = { updatedAt: now, lastAccessedAt: now }
      if (progress.understood !== undefined) {
        updates.understood = progress.understood
      }
      if (progress.incrementQuestionCount) {
        updates.questionCount = existing[0].questionCount + 1
      }
      if (progress.incrementGoodQuestionCount) {
        updates.goodQuestionCount = existing[0].goodQuestionCount + 1
      }

      await db.update(userTopicProgress).set(updates).where(eq(userTopicProgress.id, existing[0].id))

      return {
        ...existing[0],
        ...updates,
        updatedAt: now,
        lastAccessedAt: now,
      } as TopicProgress
    } else {
      const id = crypto.randomUUID()
      const newProgress: TopicProgress = {
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
    }
  },

  findProgressByUser: async (userId) => {
    return db.select().from(userTopicProgress).where(eq(userTopicProgress.userId, userId))
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
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(userTopicProgress.userId, userId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .orderBy(desc(userTopicProgress.lastAccessedAt))
      .limit(limit)

    return result.map((row) => ({
      ...row,
      lastAccessedAt: row.lastAccessedAt ?? new Date(),
    }))
  },

  touchTopic: async (userId, topicId) => {
    const existing = await db
      .select()
      .from(userTopicProgress)
      .where(and(eq(userTopicProgress.userId, userId), eq(userTopicProgress.topicId, topicId)))
      .limit(1)

    const now = new Date()

    if (existing[0]) {
      await db
        .update(userTopicProgress)
        .set({ lastAccessedAt: now, updatedAt: now })
        .where(eq(userTopicProgress.id, existing[0].id))

      return {
        ...existing[0],
        lastAccessedAt: now,
        updatedAt: now,
      }
    } else {
      const id = crypto.randomUUID()
      const newProgress: TopicProgress = {
        id,
        userId,
        topicId,
        understood: false,
        lastAccessedAt: now,
        questionCount: 0,
        goodQuestionCount: 0,
        createdAt: now,
        updatedAt: now,
      }

      await db.insert(userTopicProgress).values(newProgress)
      return newProgress
    }
  },

  createCheckHistory: async (userId, history) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(topicCheckHistory).values({
      id,
      topicId: history.topicId,
      userId,
      action: history.action,
      checkedAt: now,
    })

    return {
      id,
      topicId: history.topicId,
      userId,
      action: history.action,
      checkedAt: now,
    }
  },

  findCheckHistoryByTopic: async (userId, topicId) => {
    return db
      .select()
      .from(topicCheckHistory)
      .where(and(eq(topicCheckHistory.userId, userId), eq(topicCheckHistory.topicId, topicId)))
      .orderBy(desc(topicCheckHistory.checkedAt))
  },

  verifyTopicExists: async (userId, topicId) => {
    const result = await db
      .select({ id: topics.id })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(topics.id, topicId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)
    return result.length > 0
  },
})
