import { eq, and, isNull, sql } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { subjects, studyDomains, categories } from "@cpa-study/db/schema"

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

export type SubjectRepository = {
  findByStudyDomainId: (studyDomainId: string, userId: string) => Promise<Subject[]>
  findById: (id: string, userId: string) => Promise<Subject | null>
  create: (data: CreateSubjectInput) => Promise<{ id: string }>
  update: (id: string, userId: string, data: UpdateSubjectInput) => Promise<Subject | null>
  softDelete: (id: string, userId: string) => Promise<boolean>
  canDeleteSubject: (id: string, userId: string) => Promise<CanDeleteResult>
  verifyStudyDomainOwnership: (studyDomainId: string, userId: string) => Promise<boolean>
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
})
