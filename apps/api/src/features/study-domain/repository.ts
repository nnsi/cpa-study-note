import { eq, and, isNull, inArray } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { studyDomains, subjects, categories, topics } from "@cpa-study/db/schema"

export type StudyDomain = {
  id: string
  userId: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type CreateStudyDomainInput = {
  userId: string
  name: string
  description?: string | null
  emoji?: string | null
  color?: string | null
}

export type UpdateStudyDomainInput = {
  name?: string
  description?: string | null
  emoji?: string | null
  color?: string | null
}

export type StudyDomainRepository = {
  findByUserId: (userId: string) => Promise<StudyDomain[]>
  findById: (id: string, userId: string) => Promise<StudyDomain | null>
  create: (data: CreateStudyDomainInput) => Promise<{ id: string }>
  update: (id: string, userId: string, data: UpdateStudyDomainInput) => Promise<StudyDomain | null>
  softDelete: (id: string, userId: string) => Promise<boolean>
}

export const createStudyDomainRepository = (db: Db): StudyDomainRepository => ({
  findByUserId: async (userId) => {
    return db
      .select()
      .from(studyDomains)
      .where(and(eq(studyDomains.userId, userId), isNull(studyDomains.deletedAt)))
      .orderBy(studyDomains.createdAt)
  },

  findById: async (id, userId) => {
    const result = await db
      .select()
      .from(studyDomains)
      .where(and(eq(studyDomains.id, id), eq(studyDomains.userId, userId), isNull(studyDomains.deletedAt)))
      .limit(1)
    return result[0] ?? null
  },

  create: async (data) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(studyDomains).values({
      id,
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      emoji: data.emoji ?? null,
      color: data.color ?? null,
      createdAt: now,
      updatedAt: now,
    })
    return { id }
  },

  update: async (id, userId, data) => {
    const existing = await db
      .select()
      .from(studyDomains)
      .where(and(eq(studyDomains.id, id), eq(studyDomains.userId, userId), isNull(studyDomains.deletedAt)))
      .limit(1)

    if (!existing[0]) {
      return null
    }

    const now = new Date()
    const updates: Partial<StudyDomain> = { updatedAt: now }

    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.emoji !== undefined) updates.emoji = data.emoji
    if (data.color !== undefined) updates.color = data.color

    await db
      .update(studyDomains)
      .set(updates)
      .where(and(eq(studyDomains.id, id), eq(studyDomains.userId, userId)))

    return {
      ...existing[0],
      ...updates,
    }
  },

  softDelete: async (id, userId) => {
    // First check if the domain exists and belongs to user (not deleted)
    const existing = await db
      .select({ id: studyDomains.id })
      .from(studyDomains)
      .where(and(eq(studyDomains.id, id), eq(studyDomains.userId, userId), isNull(studyDomains.deletedAt)))
      .limit(1)

    if (!existing[0]) {
      return false
    }

    const now = new Date()

    // Cascade: soft-delete topics under this domain's subjects
    const subjectRows = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.studyDomainId, id), eq(subjects.userId, userId), isNull(subjects.deletedAt)))

    const subjectIds = subjectRows.map((s) => s.id)

    if (subjectIds.length > 0) {
      // Soft-delete topics under those subjects' categories
      const categoryRows = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(inArray(categories.subjectId, subjectIds), eq(categories.userId, userId), isNull(categories.deletedAt)))

      const categoryIds = categoryRows.map((c) => c.id)

      if (categoryIds.length > 0) {
        await db
          .update(topics)
          .set({ deletedAt: now })
          .where(and(inArray(topics.categoryId, categoryIds), eq(topics.userId, userId), isNull(topics.deletedAt)))
      }

      // Soft-delete categories
      await db
        .update(categories)
        .set({ deletedAt: now })
        .where(and(inArray(categories.subjectId, subjectIds), eq(categories.userId, userId), isNull(categories.deletedAt)))

      // Soft-delete subjects
      await db
        .update(subjects)
        .set({ deletedAt: now })
        .where(and(eq(subjects.studyDomainId, id), eq(subjects.userId, userId), isNull(subjects.deletedAt)))
    }

    // Soft-delete the domain itself
    await db
      .update(studyDomains)
      .set({ deletedAt: now })
      .where(and(eq(studyDomains.id, id), eq(studyDomains.userId, userId)))

    return true
  },
})
