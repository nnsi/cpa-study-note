import { eq, and, isNull, sql, inArray, desc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  subjects,
  studyDomains,
  categories,
  topics,
  userTopicProgress,
} from "@cpa-study/db/schema"

export type Subject = {
  id: string
  userId: string
  studyDomainId: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type CreateSubjectInput = {
  userId: string
  studyDomainId: string
  name: string
  description?: string | null
  emoji?: string | null
  color?: string | null
  displayOrder?: number
}

export type UpdateSubjectInput = {
  name?: string
  description?: string | null
  emoji?: string | null
  color?: string | null
  displayOrder?: number
}

export type CanDeleteResult = {
  canDelete: boolean
  reason?: string
}

// Tree-related types
export type CategoryRecord = {
  id: string
  userId: string
  subjectId: string
  name: string
  depth: number
  parentId: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type TopicRecord = {
  id: string
  userId: string
  categoryId: string
  name: string
  description: string | null
  difficulty: string | null
  topicType: string | null
  aiSystemPrompt: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type UpsertCategoryData = {
  id: string
  userId: string
  subjectId: string
  name: string
  depth: number
  parentId: string | null
  displayOrder: number
  now: Date
  isNew: boolean
}

export type UpsertTopicData = {
  id: string
  userId: string
  categoryId: string
  name: string
  description: string | null
  difficulty: string | null
  topicType: string | null
  aiSystemPrompt: string | null
  displayOrder: number
  now: Date
  isNew: boolean
}

export type RecentTopicRow = {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  categoryId: string
  lastAccessedAt: Date
}

export type TopicWithHierarchy = TopicRecord & {
  categoryName: string
  subjectId: string
  subjectName: string
}

export type SubjectStats = {
  categoryCount: number
  topicCount: number
}

export type BatchSubjectStats = {
  subjectId: string
  categoryCount: number
  topicCount: number
}

export type CategoryTopicCount = {
  categoryId: string
  topicCount: number
}

export type CategoryProgressCount = {
  categoryId: string
  understoodCount: number
}

export type SubjectProgressCount = {
  subjectId: string
  understoodCount: number
}

export type SubjectRepository = {
  findByStudyDomainId: (studyDomainId: string, userId: string) => Promise<Subject[]>
  findById: (id: string, userId: string) => Promise<Subject | null>
  create: (data: CreateSubjectInput) => Promise<{ id: string }>
  update: (id: string, userId: string, data: UpdateSubjectInput) => Promise<Subject | null>
  softDelete: (id: string, userId: string) => Promise<boolean>
  canDeleteSubject: (id: string, userId: string) => Promise<CanDeleteResult>
  verifyStudyDomainOwnership: (studyDomainId: string, userId: string) => Promise<boolean>
  // Hierarchy validation methods
  verifyCategoryBelongsToSubject: (categoryId: string, subjectId: string, userId: string) => Promise<boolean>
  verifyTopicBelongsToSubject: (topicId: string, subjectId: string, userId: string) => Promise<boolean>
  // Tree-related methods
  findSubjectByIdAndUserId: (subjectId: string, userId: string) => Promise<{ id: string } | null>
  findCategoriesBySubjectId: (subjectId: string, userId: string) => Promise<CategoryRecord[]>
  findTopicsByCategoryIds: (categoryIds: string[], userId: string) => Promise<TopicRecord[]>
  findCategoryIdsBySubjectIdWithSoftDeleted: (subjectId: string, userId: string, categoryIds: string[]) => Promise<string[]>
  findTopicIdsBySubjectWithSoftDeleted: (subjectId: string, userId: string, topicIds: string[]) => Promise<string[]>
  findExistingCategoryIds: (subjectId: string, userId: string) => Promise<string[]>
  findExistingTopicIds: (subjectId: string, userId: string) => Promise<string[]>
  softDeleteCategories: (categoryIds: string[], now: Date) => Promise<void>
  softDeleteTopics: (topicIds: string[], now: Date) => Promise<void>
  upsertCategory: (data: UpsertCategoryData) => Promise<void>
  upsertTopic: (data: UpsertTopicData) => Promise<void>

  // Progress stats methods (used by View feature)
  getProgressCountsByCategory: (userId: string, subjectId: string) => Promise<CategoryProgressCount[]>
  getProgressCountsBySubject: (userId: string) => Promise<SubjectProgressCount[]>
  findRecentTopics: (userId: string, limit: number) => Promise<RecentTopicRow[]>

  // Query methods (userId/deletedAt対応)
  findAllSubjectsForUser: (studyDomainId: string | undefined, userId: string) => Promise<Subject[]>
  findSubjectByIdForUser: (id: string, userId: string) => Promise<Subject | null>
  getSubjectStats: (subjectId: string, userId: string) => Promise<SubjectStats>
  getBatchSubjectStats: (subjectIds: string[], userId: string) => Promise<BatchSubjectStats[]>
  findCategoriesHierarchy: (subjectId: string, userId: string) => Promise<CategoryRecord[]>
  getCategoryTopicCounts: (subjectId: string, userId: string) => Promise<CategoryTopicCount[]>
  findTopicsByCategoryIdForUser: (categoryId: string, userId: string) => Promise<TopicRecord[]>
  findTopicById: (id: string, userId: string) => Promise<TopicRecord | null>
  findTopicWithHierarchy: (id: string, userId: string) => Promise<TopicWithHierarchy | null>
}

export const createSubjectRepository = (db: Db): SubjectRepository => ({
  findByStudyDomainId: async (studyDomainId, userId) => {
    // Join with study_domains to check parent is not deleted
    return db
      .select({
        id: subjects.id,
        userId: subjects.userId,
        studyDomainId: subjects.studyDomainId,
        name: subjects.name,
        description: subjects.description,
        emoji: subjects.emoji,
        color: subjects.color,
        displayOrder: subjects.displayOrder,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        deletedAt: subjects.deletedAt,
      })
      .from(subjects)
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(subjects.studyDomainId, studyDomainId),
          eq(subjects.userId, userId),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .orderBy(subjects.displayOrder)
  },

  findById: async (id, userId) => {
    // Join with study_domains to check parent is not deleted
    const result = await db
      .select({
        id: subjects.id,
        userId: subjects.userId,
        studyDomainId: subjects.studyDomainId,
        name: subjects.name,
        description: subjects.description,
        emoji: subjects.emoji,
        color: subjects.color,
        displayOrder: subjects.displayOrder,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        deletedAt: subjects.deletedAt,
      })
      .from(subjects)
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(subjects.id, id),
          eq(subjects.userId, userId),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)
    return result[0] ?? null
  },

  create: async (data) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(subjects).values({
      id,
      userId: data.userId,
      studyDomainId: data.studyDomainId,
      name: data.name,
      description: data.description ?? null,
      emoji: data.emoji ?? null,
      color: data.color ?? null,
      displayOrder: data.displayOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    return { id }
  },

  update: async (id, userId, data) => {
    // Check existence and ownership (including parent domain)
    const existing = await db
      .select({
        id: subjects.id,
        userId: subjects.userId,
        studyDomainId: subjects.studyDomainId,
        name: subjects.name,
        description: subjects.description,
        emoji: subjects.emoji,
        color: subjects.color,
        displayOrder: subjects.displayOrder,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        deletedAt: subjects.deletedAt,
      })
      .from(subjects)
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(subjects.id, id),
          eq(subjects.userId, userId),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)

    if (!existing[0]) {
      return null
    }

    const now = new Date()
    const updates: Partial<Subject> = { updatedAt: now }

    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.emoji !== undefined) updates.emoji = data.emoji
    if (data.color !== undefined) updates.color = data.color
    if (data.displayOrder !== undefined) updates.displayOrder = data.displayOrder

    await db
      .update(subjects)
      .set(updates)
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))

    return {
      ...existing[0],
      ...updates,
    }
  },

  softDelete: async (id, userId) => {
    // Check existence and ownership
    const existing = await db
      .select({ id: subjects.id })
      .from(subjects)
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(subjects.id, id),
          eq(subjects.userId, userId),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)

    if (!existing[0]) {
      return false
    }

    const now = new Date()
    await db
      .update(subjects)
      .set({ deletedAt: now })
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))

    return true
  },

  canDeleteSubject: async (id, userId) => {
    // Check if subject exists and belongs to user
    const subject = await db
      .select()
      .from(subjects)
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(subjects.id, id),
          eq(subjects.userId, userId),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)

    if (!subject[0]) {
      return { canDelete: true } // Doesn't exist or doesn't belong to user
    }

    // Check if there are any non-deleted categories
    const categoryCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(and(eq(categories.subjectId, id), eq(categories.userId, userId), isNull(categories.deletedAt)))

    const count = categoryCount[0]?.count ?? 0
    if (count > 0) {
      return {
        canDelete: false,
        reason: `${count}件の単元が紐づいています`,
      }
    }
    return { canDelete: true }
  },

  verifyStudyDomainOwnership: async (studyDomainId, userId) => {
    const result = await db
      .select({ id: studyDomains.id })
      .from(studyDomains)
      .where(
        and(eq(studyDomains.id, studyDomainId), eq(studyDomains.userId, userId), isNull(studyDomains.deletedAt))
      )
      .limit(1)
    return result.length > 0
  },

  verifyCategoryBelongsToSubject: async (categoryId, subjectId, userId) => {
    const result = await db
      .select({ id: categories.id })
      .from(categories)
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.subjectId, subjectId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)
    return result.length > 0
  },

  verifyTopicBelongsToSubject: async (topicId, subjectId, userId) => {
    const result = await db
      .select({ id: topics.id })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(topics.id, topicId),
          eq(categories.subjectId, subjectId),
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

  // Tree-related methods
  findSubjectByIdAndUserId: async (subjectId, userId) => {
    const result = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(
        and(eq(subjects.id, subjectId), eq(subjects.userId, userId), isNull(subjects.deletedAt))
      )
      .limit(1)
    return result[0] ?? null
  },

  findCategoriesBySubjectId: async (subjectId, userId) => {
    return db
      .select()
      .from(categories)
      .where(
        and(eq(categories.subjectId, subjectId), eq(categories.userId, userId), isNull(categories.deletedAt))
      )
      .orderBy(categories.displayOrder)
  },

  findTopicsByCategoryIds: async (categoryIds, userId) => {
    if (categoryIds.length === 0) {
      return []
    }
    return db
      .select()
      .from(topics)
      .where(and(inArray(topics.categoryId, categoryIds), eq(topics.userId, userId), isNull(topics.deletedAt)))
      .orderBy(topics.displayOrder)
  },

  findCategoryIdsBySubjectIdWithSoftDeleted: async (subjectId, userId, categoryIds) => {
    if (categoryIds.length === 0) {
      return []
    }
    const result = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          inArray(categories.id, categoryIds),
          eq(categories.userId, userId),
          eq(categories.subjectId, subjectId)
        )
      )
    return result.map((c) => c.id)
  },

  findTopicIdsBySubjectWithSoftDeleted: async (subjectId, userId, topicIds) => {
    if (topicIds.length === 0) {
      return []
    }
    const result = await db
      .select({ id: topics.id })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(
        and(
          inArray(topics.id, topicIds),
          eq(topics.userId, userId),
          eq(categories.subjectId, subjectId)
        )
      )
    return result.map((t) => t.id)
  },

  findExistingCategoryIds: async (subjectId, userId) => {
    const result = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.subjectId, subjectId), eq(categories.userId, userId), isNull(categories.deletedAt))
      )
    return result.map((c) => c.id)
  },

  findExistingTopicIds: async (subjectId, userId) => {
    const result = await db
      .select({ id: topics.id })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .where(
        and(eq(categories.subjectId, subjectId), eq(topics.userId, userId), isNull(topics.deletedAt))
      )
    return result.map((t) => t.id)
  },

  softDeleteCategories: async (categoryIds, now) => {
    if (categoryIds.length === 0) {
      return
    }
    await db
      .update(categories)
      .set({ deletedAt: now })
      .where(inArray(categories.id, categoryIds))
  },

  softDeleteTopics: async (topicIds, now) => {
    if (topicIds.length === 0) {
      return
    }
    await db
      .update(topics)
      .set({ deletedAt: now })
      .where(inArray(topics.id, topicIds))
  },

  upsertCategory: async (data) => {
    if (data.isNew) {
      await db.insert(categories).values({
        id: data.id,
        userId: data.userId,
        subjectId: data.subjectId,
        name: data.name,
        depth: data.depth,
        parentId: data.parentId,
        displayOrder: data.displayOrder,
        createdAt: data.now,
        updatedAt: data.now,
        deletedAt: null,
      })
    } else {
      await db
        .update(categories)
        .set({
          name: data.name,
          depth: data.depth,
          parentId: data.parentId,
          displayOrder: data.displayOrder,
          updatedAt: data.now,
          deletedAt: null,
        })
        .where(eq(categories.id, data.id))
    }
  },

  upsertTopic: async (data) => {
    if (data.isNew) {
      await db.insert(topics).values({
        id: data.id,
        userId: data.userId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        difficulty: data.difficulty,
        topicType: data.topicType,
        aiSystemPrompt: data.aiSystemPrompt,
        displayOrder: data.displayOrder,
        createdAt: data.now,
        updatedAt: data.now,
        deletedAt: null,
      })
    } else {
      await db
        .update(topics)
        .set({
          categoryId: data.categoryId,
          name: data.name,
          description: data.description,
          difficulty: data.difficulty,
          topicType: data.topicType,
          aiSystemPrompt: data.aiSystemPrompt,
          displayOrder: data.displayOrder,
          updatedAt: data.now,
          deletedAt: null,
        })
        .where(eq(topics.id, data.id))
    }
  },

  // Progress stats methods (used by View feature)
  getProgressCountsByCategory: async (userId, subjectId) => {
    const result = await db
      .select({
        categoryId: topics.categoryId,
        understoodCount: sql<number>`count(*)`.as("understood_count"),
      })
      .from(userTopicProgress)
      .innerJoin(topics, eq(userTopicProgress.topicId, topics.id))
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .where(
        and(
          eq(userTopicProgress.userId, userId),
          eq(userTopicProgress.understood, true),
          eq(categories.subjectId, subjectId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt)
        )
      )
      .groupBy(topics.categoryId)

    return result
  },

  getProgressCountsBySubject: async (userId) => {
    const result = await db
      .select({
        subjectId: categories.subjectId,
        understoodCount: sql<number>`count(*)`.as("understood_count"),
      })
      .from(userTopicProgress)
      .innerJoin(topics, eq(userTopicProgress.topicId, topics.id))
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(userTopicProgress.userId, userId),
          eq(userTopicProgress.understood, true),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
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
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(userTopicProgress.userId, userId),
          // トピックの所有者でもフィルタリング（他ユーザーのトピックは除外）
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

  // Query methods (userId/deletedAt対応)
  findAllSubjectsForUser: async (studyDomainId, userId) => {
    const conditions = [eq(subjects.userId, userId), isNull(subjects.deletedAt), isNull(studyDomains.deletedAt)]

    if (studyDomainId) {
      conditions.push(eq(subjects.studyDomainId, studyDomainId))
    }

    return db
      .select({
        id: subjects.id,
        userId: subjects.userId,
        studyDomainId: subjects.studyDomainId,
        name: subjects.name,
        description: subjects.description,
        emoji: subjects.emoji,
        color: subjects.color,
        displayOrder: subjects.displayOrder,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        deletedAt: subjects.deletedAt,
      })
      .from(subjects)
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(and(...conditions))
      .orderBy(subjects.displayOrder)
  },

  findSubjectByIdForUser: async (id, userId) => {
    const result = await db
      .select({
        id: subjects.id,
        userId: subjects.userId,
        studyDomainId: subjects.studyDomainId,
        name: subjects.name,
        description: subjects.description,
        emoji: subjects.emoji,
        color: subjects.color,
        displayOrder: subjects.displayOrder,
        createdAt: subjects.createdAt,
        updatedAt: subjects.updatedAt,
        deletedAt: subjects.deletedAt,
      })
      .from(subjects)
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId), isNull(subjects.deletedAt), isNull(studyDomains.deletedAt)))
      .limit(1)

    return result[0] ?? null
  },

  getSubjectStats: async (subjectId, userId) => {
    const categoryResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(categories)
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(categories.subjectId, subjectId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )

    const topicResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(categories.subjectId, subjectId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )

    return {
      categoryCount: categoryResult[0]?.count ?? 0,
      topicCount: topicResult[0]?.count ?? 0,
    }
  },

  getBatchSubjectStats: async (subjectIds, userId) => {
    if (subjectIds.length === 0) return []

    // カテゴリ数をバッチ取得
    const categoryResults = await db
      .select({
        subjectId: categories.subjectId,
        count: sql<number>`count(*)`,
      })
      .from(categories)
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          inArray(categories.subjectId, subjectIds),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .groupBy(categories.subjectId)

    // トピック数をバッチ取得
    const topicResults = await db
      .select({
        subjectId: categories.subjectId,
        count: sql<number>`count(*)`,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          inArray(categories.subjectId, subjectIds),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .groupBy(categories.subjectId)

    const categoryCountMap = new Map(categoryResults.map((r) => [r.subjectId, r.count]))
    const topicCountMap = new Map(topicResults.map((r) => [r.subjectId, r.count]))

    return subjectIds.map((subjectId) => ({
      subjectId,
      categoryCount: categoryCountMap.get(subjectId) ?? 0,
      topicCount: topicCountMap.get(subjectId) ?? 0,
    }))
  },

  findCategoriesHierarchy: async (subjectId, userId) => {
    return db
      .select()
      .from(categories)
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(categories.subjectId, subjectId),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .orderBy(categories.displayOrder)
      .then((rows) =>
        rows.map((row) => ({
          id: row.categories.id,
          userId: row.categories.userId,
          subjectId: row.categories.subjectId,
          name: row.categories.name,
          depth: row.categories.depth,
          parentId: row.categories.parentId,
          displayOrder: row.categories.displayOrder,
          createdAt: row.categories.createdAt,
          updatedAt: row.categories.updatedAt,
          deletedAt: row.categories.deletedAt,
        }))
      )
  },

  getCategoryTopicCounts: async (subjectId, userId) => {
    const result = await db
      .select({
        categoryId: topics.categoryId,
        topicCount: sql<number>`count(*)`.as("topic_count"),
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(categories.subjectId, subjectId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .groupBy(topics.categoryId)

    return result
  },

  findTopicsByCategoryIdForUser: async (categoryId, userId) => {
    const result = await db
      .select({
        id: topics.id,
        userId: topics.userId,
        categoryId: topics.categoryId,
        name: topics.name,
        description: topics.description,
        difficulty: topics.difficulty,
        topicType: topics.topicType,
        aiSystemPrompt: topics.aiSystemPrompt,
        displayOrder: topics.displayOrder,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
        deletedAt: topics.deletedAt,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(topics.categoryId, categoryId),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .orderBy(topics.displayOrder)

    return result
  },

  findTopicById: async (id, userId) => {
    const result = await db
      .select({
        id: topics.id,
        userId: topics.userId,
        categoryId: topics.categoryId,
        name: topics.name,
        description: topics.description,
        difficulty: topics.difficulty,
        topicType: topics.topicType,
        aiSystemPrompt: topics.aiSystemPrompt,
        displayOrder: topics.displayOrder,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
        deletedAt: topics.deletedAt,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(topics.id, id),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)

    return result[0] ?? null
  },

  findTopicWithHierarchy: async (id, userId) => {
    const result = await db
      .select({
        id: topics.id,
        userId: topics.userId,
        categoryId: topics.categoryId,
        name: topics.name,
        description: topics.description,
        difficulty: topics.difficulty,
        topicType: topics.topicType,
        aiSystemPrompt: topics.aiSystemPrompt,
        displayOrder: topics.displayOrder,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
        deletedAt: topics.deletedAt,
        categoryName: categories.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(
        and(
          eq(topics.id, id),
          eq(topics.userId, userId),
          isNull(topics.deletedAt),
          isNull(categories.deletedAt),
          isNull(subjects.deletedAt),
          isNull(studyDomains.deletedAt)
        )
      )
      .limit(1)

    return result[0] ?? null
  },
})
