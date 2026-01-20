import { eq, and, sql } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  subjects,
  categories,
  topics,
  userTopicProgress,
} from "@cpa-study/db/schema"

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
})
