import { eq, and, isNull, desc, sql } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { traced, type Tracer } from "@/shared/lib/tracer"
import { runBatch, type BatchStatement } from "@/shared/lib/transaction"
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
  domainId: string
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

  // 論点を理解済みにマークし、チェック履歴を残す（progress upsert + history insert を原子的に実行）
  markTopicUnderstood: (userId: string, topicId: string) => Promise<void>

  // Validation methods
  verifyTopicExists: (userId: string, topicId: string) => Promise<boolean>
}

export const tracedLearningRepo = (repo: LearningRepository, tracer: Tracer): LearningRepository => ({
  findProgress: traced(tracer, "d1.findProgress", repo.findProgress),
  upsertProgress: traced(tracer, "d1.upsertProgress", repo.upsertProgress),
  findProgressByUser: traced(tracer, "d1.findProgressByUser", repo.findProgressByUser),
  findRecentTopics: traced(tracer, "d1.findRecentTopics", repo.findRecentTopics),
  touchTopic: traced(tracer, "d1.touchTopic", repo.touchTopic),
  createCheckHistory: traced(tracer, "d1.createCheckHistory", repo.createCheckHistory),
  findCheckHistoryByTopic: traced(tracer, "d1.findCheckHistoryByTopic", repo.findCheckHistoryByTopic),
  markTopicUnderstood: traced(tracer, "d1.markTopicUnderstood", repo.markTopicUnderstood),
  verifyTopicExists: traced(tracer, "d1.verifyTopicExists", repo.verifyTopicExists),
})

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
    const result = await db
      .select({
        id: userTopicProgress.id,
        userId: userTopicProgress.userId,
        topicId: userTopicProgress.topicId,
        understood: userTopicProgress.understood,
        lastAccessedAt: userTopicProgress.lastAccessedAt,
        questionCount: userTopicProgress.questionCount,
        goodQuestionCount: userTopicProgress.goodQuestionCount,
        createdAt: userTopicProgress.createdAt,
        updatedAt: userTopicProgress.updatedAt,
      })
      .from(userTopicProgress)
      .innerJoin(topics, eq(userTopicProgress.topicId, topics.id))
      .where(and(eq(userTopicProgress.userId, userId), isNull(topics.deletedAt)))
    return result
  },

  findRecentTopics: async (userId, limit) => {
    const result = await db
      .select({
        topicId: topics.id,
        topicName: topics.name,
        domainId: studyDomains.id,
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

  markTopicUnderstood: async (userId, topicId) => {
    const existing = await db
      .select()
      .from(userTopicProgress)
      .where(and(eq(userTopicProgress.userId, userId), eq(userTopicProgress.topicId, topicId)))
      .limit(1)

    const now = new Date()

    // userTopicProgress は (userId, topicId) の一意制約が無いため upsert は読み取り前提。
    // 読み取り後は書き込みが確定するので、progress と check history を batch で原子化できる。
    const progressStmt: BatchStatement = existing[0]
      ? db
          .update(userTopicProgress)
          .set({ understood: true, updatedAt: now, lastAccessedAt: now })
          .where(eq(userTopicProgress.id, existing[0].id))
      : db.insert(userTopicProgress).values({
          id: crypto.randomUUID(),
          userId,
          topicId,
          understood: true,
          lastAccessedAt: now,
          questionCount: 0,
          goodQuestionCount: 0,
          createdAt: now,
          updatedAt: now,
        })

    const historyStmt: BatchStatement = db.insert(topicCheckHistory).values({
      id: crypto.randomUUID(),
      topicId,
      userId,
      action: "checked",
      checkedAt: now,
    })

    await runBatch(db, [progressStmt, historyStmt])
  },

  findCheckHistoryByTopic: async (userId, topicId) => {
    return db
      .select()
      .from(topicCheckHistory)
      .where(and(eq(topicCheckHistory.userId, userId), eq(topicCheckHistory.topicId, topicId)))
      .orderBy(desc(topicCheckHistory.checkedAt), desc(sql`rowid`))
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
