import { eq, and, isNull, sql, desc, asc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { studyPlans, studyPlanItems, studyPlanRevisions, subjects, topics } from "@cpa-study/db/schema"
import type { StudyPlanScope } from "@cpa-study/db/schema"

export type StudyPlan = {
  id: string
  userId: string
  title: string
  intent: string | null
  scope: StudyPlanScope
  subjectId: string | null
  subjectName: string | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export type StudyPlanItem = {
  id: string
  studyPlanId: string
  topicId: string | null
  topicName: string | null
  description: string
  rationale: string | null
  orderIndex: number
  createdAt: Date
}

export type StudyPlanRevision = {
  id: string
  studyPlanId: string
  summary: string
  reason: string | null
  createdAt: Date
}

export type StudyPlanWithItemCount = StudyPlan & { itemCount: number }

export type StudyPlanRepository = {
  findPlansByUser: (userId: string, filter?: { archived?: boolean }) => Promise<StudyPlanWithItemCount[]>
  findPlanById: (planId: string) => Promise<StudyPlan | null>
  createPlan: (data: { id: string; userId: string; title: string; intent?: string; scope: StudyPlanScope; subjectId?: string; now: Date }) => Promise<StudyPlan>
  updatePlan: (planId: string, data: { title?: string; intent?: string | null; subjectId?: string | null }) => Promise<StudyPlan | null>
  archivePlan: (planId: string) => Promise<boolean>
  unarchivePlan: (planId: string) => Promise<boolean>
  duplicatePlan: (sourcePlanId: string, newPlanId: string, userId: string) => Promise<StudyPlan | null>
  findItemsByPlan: (planId: string) => Promise<StudyPlanItem[]>
  createItem: (data: { id: string; studyPlanId: string; topicId?: string; description: string; rationale?: string; orderIndex: number; now: Date }) => Promise<StudyPlanItem>
  updateItem: (itemId: string, data: { description?: string; rationale?: string | null; topicId?: string | null; orderIndex?: number }) => Promise<StudyPlanItem | null>
  deleteItem: (itemId: string) => Promise<boolean>
  reorderItems: (planId: string, itemIds: string[]) => Promise<void>
  findItemById: (itemId: string) => Promise<StudyPlanItem | null>
  findRevisionsByPlan: (planId: string) => Promise<StudyPlanRevision[]>
  createRevision: (data: { id: string; studyPlanId: string; summary: string; reason?: string; now: Date }) => Promise<StudyPlanRevision>
  updateRevision: (revisionId: string, data: { reason?: string | null }) => Promise<StudyPlanRevision | null>
  isPlanOwnedByUser: (planId: string, userId: string) => Promise<boolean>
}

export const createStudyPlanRepository = (db: Db): StudyPlanRepository => ({
  findPlansByUser: async (userId, filter) => {
    // Build where conditions
    const conditions = [eq(studyPlans.userId, userId)]
    if (filter?.archived === true) {
      conditions.push(sql`${studyPlans.archivedAt} IS NOT NULL`)
    } else if (filter?.archived === false) {
      conditions.push(isNull(studyPlans.archivedAt))
    }

    const plans = await db
      .select({
        id: studyPlans.id,
        userId: studyPlans.userId,
        title: studyPlans.title,
        intent: studyPlans.intent,
        scope: studyPlans.scope,
        subjectId: studyPlans.subjectId,
        subjectName: subjects.name,
        createdAt: studyPlans.createdAt,
        updatedAt: studyPlans.updatedAt,
        archivedAt: studyPlans.archivedAt,
      })
      .from(studyPlans)
      .leftJoin(subjects, eq(studyPlans.subjectId, subjects.id))
      .where(and(...conditions))
      .orderBy(desc(studyPlans.updatedAt))

    // Get item counts
    const result: StudyPlanWithItemCount[] = []
    for (const plan of plans) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(studyPlanItems)
        .where(eq(studyPlanItems.studyPlanId, plan.id))
      result.push({ ...plan, subjectName: plan.subjectName ?? null, itemCount: Number(countResult[0].count) })
    }
    return result
  },

  findPlanById: async (planId) => {
    const result = await db
      .select({
        id: studyPlans.id,
        userId: studyPlans.userId,
        title: studyPlans.title,
        intent: studyPlans.intent,
        scope: studyPlans.scope,
        subjectId: studyPlans.subjectId,
        subjectName: subjects.name,
        createdAt: studyPlans.createdAt,
        updatedAt: studyPlans.updatedAt,
        archivedAt: studyPlans.archivedAt,
      })
      .from(studyPlans)
      .leftJoin(subjects, eq(studyPlans.subjectId, subjects.id))
      .where(eq(studyPlans.id, planId))
      .limit(1)
    return result.length > 0 ? { ...result[0], subjectName: result[0].subjectName ?? null } : null
  },

  createPlan: async ({ id, userId, title, intent, scope, subjectId, now }) => {
    await db.insert(studyPlans).values({
      id,
      userId,
      title,
      intent: intent ?? null,
      scope,
      subjectId: subjectId ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    })
    // Re-fetch with subject name
    const result = await db
      .select({
        id: studyPlans.id, userId: studyPlans.userId, title: studyPlans.title,
        intent: studyPlans.intent, scope: studyPlans.scope, subjectId: studyPlans.subjectId,
        subjectName: subjects.name, createdAt: studyPlans.createdAt, updatedAt: studyPlans.updatedAt,
        archivedAt: studyPlans.archivedAt,
      })
      .from(studyPlans)
      .leftJoin(subjects, eq(studyPlans.subjectId, subjects.id))
      .where(eq(studyPlans.id, id))
      .limit(1)
    return { ...result[0], subjectName: result[0].subjectName ?? null }
  },

  updatePlan: async (planId, data) => {
    const existing = await db.select().from(studyPlans).where(eq(studyPlans.id, planId)).limit(1)
    if (existing.length === 0) return null

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.title !== undefined) updates.title = data.title
    if (data.intent !== undefined) updates.intent = data.intent
    if (data.subjectId !== undefined) updates.subjectId = data.subjectId

    await db.update(studyPlans).set(updates).where(eq(studyPlans.id, planId))

    const result = await db
      .select({
        id: studyPlans.id, userId: studyPlans.userId, title: studyPlans.title,
        intent: studyPlans.intent, scope: studyPlans.scope, subjectId: studyPlans.subjectId,
        subjectName: subjects.name, createdAt: studyPlans.createdAt, updatedAt: studyPlans.updatedAt,
        archivedAt: studyPlans.archivedAt,
      })
      .from(studyPlans)
      .leftJoin(subjects, eq(studyPlans.subjectId, subjects.id))
      .where(eq(studyPlans.id, planId))
      .limit(1)
    return result.length > 0 ? { ...result[0], subjectName: result[0].subjectName ?? null } : null
  },

  archivePlan: async (planId) => {
    const existing = await db.select().from(studyPlans).where(eq(studyPlans.id, planId)).limit(1)
    if (existing.length === 0) return false
    await db.update(studyPlans).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(studyPlans.id, planId))
    return true
  },

  unarchivePlan: async (planId) => {
    const existing = await db.select().from(studyPlans).where(eq(studyPlans.id, planId)).limit(1)
    if (existing.length === 0) return false
    await db.update(studyPlans).set({ archivedAt: null, updatedAt: new Date() }).where(eq(studyPlans.id, planId))
    return true
  },

  duplicatePlan: async (sourcePlanId, newPlanId, userId) => {
    const source = await db.select().from(studyPlans).where(eq(studyPlans.id, sourcePlanId)).limit(1)
    if (source.length === 0) return null

    const now = new Date()
    await db.insert(studyPlans).values({
      id: newPlanId,
      userId,
      title: `${source[0].title}（複製）`,
      intent: source[0].intent,
      scope: source[0].scope as StudyPlanScope,
      subjectId: source[0].subjectId,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    })

    // Duplicate items
    const sourceItems = await db.select().from(studyPlanItems).where(eq(studyPlanItems.studyPlanId, sourcePlanId)).orderBy(asc(studyPlanItems.orderIndex))
    for (const item of sourceItems) {
      await db.insert(studyPlanItems).values({
        id: crypto.randomUUID(),
        studyPlanId: newPlanId,
        topicId: item.topicId,
        description: item.description,
        rationale: item.rationale,
        orderIndex: item.orderIndex,
        createdAt: now,
      })
    }

    // Re-fetch with subject name
    const result = await db
      .select({
        id: studyPlans.id, userId: studyPlans.userId, title: studyPlans.title,
        intent: studyPlans.intent, scope: studyPlans.scope, subjectId: studyPlans.subjectId,
        subjectName: subjects.name, createdAt: studyPlans.createdAt, updatedAt: studyPlans.updatedAt,
        archivedAt: studyPlans.archivedAt,
      })
      .from(studyPlans)
      .leftJoin(subjects, eq(studyPlans.subjectId, subjects.id))
      .where(eq(studyPlans.id, newPlanId))
      .limit(1)
    return result.length > 0 ? { ...result[0], subjectName: result[0].subjectName ?? null } : null
  },

  findItemsByPlan: async (planId) => {
    const items = await db
      .select({
        id: studyPlanItems.id,
        studyPlanId: studyPlanItems.studyPlanId,
        topicId: studyPlanItems.topicId,
        topicName: topics.name,
        description: studyPlanItems.description,
        rationale: studyPlanItems.rationale,
        orderIndex: studyPlanItems.orderIndex,
        createdAt: studyPlanItems.createdAt,
      })
      .from(studyPlanItems)
      .leftJoin(topics, eq(studyPlanItems.topicId, topics.id))
      .where(eq(studyPlanItems.studyPlanId, planId))
      .orderBy(asc(studyPlanItems.orderIndex))
    return items.map((item) => ({
      ...item,
      topicName: item.topicName ?? null,
    }))
  },

  createItem: async ({ id, studyPlanId, topicId, description, rationale, orderIndex, now }) => {
    await db.insert(studyPlanItems).values({
      id,
      studyPlanId,
      topicId: topicId ?? null,
      description,
      rationale: rationale ?? null,
      orderIndex,
      createdAt: now,
    })
    // Return with topic name joined
    const items = await db
      .select({
        id: studyPlanItems.id,
        studyPlanId: studyPlanItems.studyPlanId,
        topicId: studyPlanItems.topicId,
        topicName: topics.name,
        description: studyPlanItems.description,
        rationale: studyPlanItems.rationale,
        orderIndex: studyPlanItems.orderIndex,
        createdAt: studyPlanItems.createdAt,
      })
      .from(studyPlanItems)
      .leftJoin(topics, eq(studyPlanItems.topicId, topics.id))
      .where(eq(studyPlanItems.id, id))
      .limit(1)
    return { ...items[0], topicName: items[0].topicName ?? null }
  },

  updateItem: async (itemId, data) => {
    const existing = await db.select().from(studyPlanItems).where(eq(studyPlanItems.id, itemId)).limit(1)
    if (existing.length === 0) return null

    const updates: Record<string, unknown> = {}
    if (data.description !== undefined) updates.description = data.description
    if (data.rationale !== undefined) updates.rationale = data.rationale
    if (data.topicId !== undefined) updates.topicId = data.topicId
    if (data.orderIndex !== undefined) updates.orderIndex = data.orderIndex

    if (Object.keys(updates).length > 0) {
      await db.update(studyPlanItems).set(updates).where(eq(studyPlanItems.id, itemId))
    }

    const items = await db
      .select({
        id: studyPlanItems.id,
        studyPlanId: studyPlanItems.studyPlanId,
        topicId: studyPlanItems.topicId,
        topicName: topics.name,
        description: studyPlanItems.description,
        rationale: studyPlanItems.rationale,
        orderIndex: studyPlanItems.orderIndex,
        createdAt: studyPlanItems.createdAt,
      })
      .from(studyPlanItems)
      .leftJoin(topics, eq(studyPlanItems.topicId, topics.id))
      .where(eq(studyPlanItems.id, itemId))
      .limit(1)
    return items.length > 0 ? { ...items[0], topicName: items[0].topicName ?? null } : null
  },

  deleteItem: async (itemId) => {
    const existing = await db.select().from(studyPlanItems).where(eq(studyPlanItems.id, itemId)).limit(1)
    if (existing.length === 0) return false
    await db.delete(studyPlanItems).where(eq(studyPlanItems.id, itemId))
    return true
  },

  reorderItems: async (planId, itemIds) => {
    for (let i = 0; i < itemIds.length; i++) {
      await db
        .update(studyPlanItems)
        .set({ orderIndex: i })
        .where(and(eq(studyPlanItems.id, itemIds[i]), eq(studyPlanItems.studyPlanId, planId)))
    }
  },

  findItemById: async (itemId) => {
    const items = await db
      .select({
        id: studyPlanItems.id,
        studyPlanId: studyPlanItems.studyPlanId,
        topicId: studyPlanItems.topicId,
        topicName: topics.name,
        description: studyPlanItems.description,
        rationale: studyPlanItems.rationale,
        orderIndex: studyPlanItems.orderIndex,
        createdAt: studyPlanItems.createdAt,
      })
      .from(studyPlanItems)
      .leftJoin(topics, eq(studyPlanItems.topicId, topics.id))
      .where(eq(studyPlanItems.id, itemId))
      .limit(1)
    return items.length > 0 ? { ...items[0], topicName: items[0].topicName ?? null } : null
  },

  findRevisionsByPlan: async (planId) => {
    return db
      .select()
      .from(studyPlanRevisions)
      .where(eq(studyPlanRevisions.studyPlanId, planId))
      .orderBy(desc(studyPlanRevisions.createdAt))
  },

  createRevision: async ({ id, studyPlanId, summary, reason, now }) => {
    const revision = { id, studyPlanId, summary, reason: reason ?? null, createdAt: now }
    await db.insert(studyPlanRevisions).values(revision)
    return revision
  },

  updateRevision: async (revisionId, data) => {
    const existing = await db.select().from(studyPlanRevisions).where(eq(studyPlanRevisions.id, revisionId)).limit(1)
    if (existing.length === 0) return null

    const updates: Record<string, unknown> = {}
    if (data.reason !== undefined) updates.reason = data.reason

    if (Object.keys(updates).length > 0) {
      await db.update(studyPlanRevisions).set(updates).where(eq(studyPlanRevisions.id, revisionId))
    }

    const result = await db.select().from(studyPlanRevisions).where(eq(studyPlanRevisions.id, revisionId)).limit(1)
    return result.length > 0 ? result[0] : null
  },

  isPlanOwnedByUser: async (planId, userId) => {
    const result = await db
      .select({ id: studyPlans.id })
      .from(studyPlans)
      .where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)))
      .limit(1)
    return result.length > 0
  },
})
