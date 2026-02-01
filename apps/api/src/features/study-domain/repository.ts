import { eq, and, sql } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { studyDomains, userStudyDomains, subjects, users } from "@cpa-study/db/schema"

export type StudyDomain = {
  id: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

export type UserStudyDomain = {
  id: string
  userId: string
  studyDomainId: string
  joinedAt: Date
}

export type CreateStudyDomainInput = {
  id: string
  name: string
  description?: string | null
  emoji?: string | null
  color?: string | null
  isPublic?: boolean
}

export type UpdateStudyDomainInput = {
  name?: string
  description?: string | null
  emoji?: string | null
  color?: string | null
  isPublic?: boolean
}

export type CanDeleteResult = {
  canDelete: boolean
  reason?: string
}

export type StudyDomainRepository = {
  findAllPublic: () => Promise<StudyDomain[]>
  findById: (id: string) => Promise<StudyDomain | null>
  create: (data: CreateStudyDomainInput) => Promise<StudyDomain>
  update: (id: string, data: UpdateStudyDomainInput) => Promise<StudyDomain | null>
  remove: (id: string) => Promise<boolean>
  canDeleteStudyDomain: (id: string) => Promise<CanDeleteResult>
  findByUserId: (userId: string) => Promise<(UserStudyDomain & { studyDomain: StudyDomain })[]>
  joinDomain: (userId: string, studyDomainId: string) => Promise<UserStudyDomain>
  leaveDomain: (userId: string, studyDomainId: string) => Promise<boolean>
  findUserStudyDomain: (userId: string, studyDomainId: string) => Promise<UserStudyDomain | null>
  clearUserDefaultDomainIfMatches: (userId: string, studyDomainId: string) => Promise<boolean>
}

export const createStudyDomainRepository = (db: Db): StudyDomainRepository => ({
  findAllPublic: async () => {
    return db
      .select()
      .from(studyDomains)
      .where(eq(studyDomains.isPublic, true))
      .orderBy(studyDomains.name)
  },

  findById: async (id) => {
    const result = await db
      .select()
      .from(studyDomains)
      .where(eq(studyDomains.id, id))
      .limit(1)
    return result[0] ?? null
  },

  create: async (data) => {
    const now = new Date()
    const newDomain: StudyDomain = {
      id: data.id,
      name: data.name,
      description: data.description ?? null,
      emoji: data.emoji ?? null,
      color: data.color ?? null,
      isPublic: data.isPublic ?? true,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(studyDomains).values(newDomain)
    return newDomain
  },

  update: async (id, data) => {
    const existing = await db
      .select()
      .from(studyDomains)
      .where(eq(studyDomains.id, id))
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
    if (data.isPublic !== undefined) updates.isPublic = data.isPublic

    await db
      .update(studyDomains)
      .set(updates)
      .where(eq(studyDomains.id, id))

    return {
      ...existing[0],
      ...updates,
    }
  },

  remove: async (id) => {
    await db.delete(studyDomains).where(eq(studyDomains.id, id))
    return true
  },

  canDeleteStudyDomain: async (id) => {
    const subjectCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .where(eq(subjects.studyDomainId, id))

    const count = subjectCount[0]?.count ?? 0
    if (count > 0) {
      return {
        canDelete: false,
        reason: `${count}件の科目が紐づいています`,
      }
    }
    return { canDelete: true }
  },

  findByUserId: async (userId) => {
    const result = await db
      .select({
        id: userStudyDomains.id,
        userId: userStudyDomains.userId,
        studyDomainId: userStudyDomains.studyDomainId,
        joinedAt: userStudyDomains.joinedAt,
        studyDomain: studyDomains,
      })
      .from(userStudyDomains)
      .innerJoin(studyDomains, eq(userStudyDomains.studyDomainId, studyDomains.id))
      .where(eq(userStudyDomains.userId, userId))
      .orderBy(userStudyDomains.joinedAt)

    return result
  },

  joinDomain: async (userId, studyDomainId) => {
    const id = crypto.randomUUID()
    const now = new Date()

    const newRecord: UserStudyDomain = {
      id,
      userId,
      studyDomainId,
      joinedAt: now,
    }

    await db.insert(userStudyDomains).values(newRecord)
    return newRecord
  },

  leaveDomain: async (userId, studyDomainId) => {
    // Only delete the user_study_domains record
    // Keep learning history (userTopicProgress, chatSessions, notes, etc.) per design doc "痕跡を残す" principle
    await db
      .delete(userStudyDomains)
      .where(
        and(
          eq(userStudyDomains.userId, userId),
          eq(userStudyDomains.studyDomainId, studyDomainId)
        )
      )
    return true
  },

  findUserStudyDomain: async (userId, studyDomainId) => {
    const result = await db
      .select()
      .from(userStudyDomains)
      .where(
        and(
          eq(userStudyDomains.userId, userId),
          eq(userStudyDomains.studyDomainId, studyDomainId)
        )
      )
      .limit(1)
    return result[0] ?? null
  },

  clearUserDefaultDomainIfMatches: async (userId, studyDomainId) => {
    // Clear user's defaultStudyDomainId if it matches the domain being left
    await db
      .update(users)
      .set({ defaultStudyDomainId: null, updatedAt: new Date() })
      .where(
        and(
          eq(users.id, userId),
          eq(users.defaultStudyDomainId, studyDomainId)
        )
      )
    return true
  },
})
