import { eq, and, desc } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { notes, topics, categories, subjects } from "@cpa-study/db/schema"

export type Note = {
  id: string
  userId: string
  topicId: string
  sessionId: string | null
  aiSummary: string | null
  userMemo: string | null
  keyPoints: string[]
  stumbledPoints: string[]
  createdAt: Date
  updatedAt: Date
}

export type NoteWithTopic = Note & {
  topicName: string
  subjectName: string
}

export type NoteWithTopicDetail = Note & {
  topicName: string
  categoryId: string
  subjectId: string
  subjectName: string
}

export type NoteRepository = {
  create: (data: Omit<Note, "id" | "createdAt" | "updatedAt">) => Promise<Note>
  findById: (id: string) => Promise<Note | null>
  findByIdWithTopic: (id: string) => Promise<NoteWithTopicDetail | null>
  findBySessionId: (sessionId: string) => Promise<Note | null>
  findByTopic: (userId: string, topicId: string) => Promise<Note[]>
  findByUser: (userId: string) => Promise<NoteWithTopic[]>
  update: (
    id: string,
    data: Partial<Pick<Note, "aiSummary" | "userMemo" | "keyPoints" | "stumbledPoints">>
  ) => Promise<Note | null>
  deleteById: (id: string) => Promise<boolean>
}

export const createNoteRepository = (db: Db): NoteRepository => ({
  create: async (data) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(notes).values({
      id,
      userId: data.userId,
      topicId: data.topicId,
      sessionId: data.sessionId,
      aiSummary: data.aiSummary,
      userMemo: data.userMemo,
      keyPoints: data.keyPoints,
      stumbledPoints: data.stumbledPoints,
      createdAt: now,
      updatedAt: now,
    })

    return { id, ...data, createdAt: now, updatedAt: now }
  },

  findById: async (id) => {
    const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1)
    if (!result[0]) return null

    return {
      ...result[0],
      keyPoints: (result[0].keyPoints as string[]) ?? [],
      stumbledPoints: (result[0].stumbledPoints as string[]) ?? [],
    }
  },

  findBySessionId: async (sessionId) => {
    const result = await db
      .select()
      .from(notes)
      .where(eq(notes.sessionId, sessionId))
      .limit(1)

    if (!result[0]) return null

    return {
      ...result[0],
      keyPoints: (result[0].keyPoints as string[]) ?? [],
      stumbledPoints: (result[0].stumbledPoints as string[]) ?? [],
    }
  },

  findByIdWithTopic: async (id) => {
    const result = await db
      .select({
        id: notes.id,
        userId: notes.userId,
        topicId: notes.topicId,
        sessionId: notes.sessionId,
        aiSummary: notes.aiSummary,
        userMemo: notes.userMemo,
        keyPoints: notes.keyPoints,
        stumbledPoints: notes.stumbledPoints,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        topicName: topics.name,
        categoryId: categories.id,
        subjectId: subjects.id,
        subjectName: subjects.name,
      })
      .from(notes)
      .innerJoin(topics, eq(notes.topicId, topics.id))
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .where(eq(notes.id, id))
      .limit(1)

    if (!result[0]) return null

    return {
      ...result[0],
      keyPoints: (result[0].keyPoints as string[]) ?? [],
      stumbledPoints: (result[0].stumbledPoints as string[]) ?? [],
    }
  },

  findByTopic: async (userId, topicId) => {
    const result = await db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.topicId, topicId)))
      .orderBy(desc(notes.createdAt))

    return result.map((n) => ({
      ...n,
      keyPoints: (n.keyPoints as string[]) ?? [],
      stumbledPoints: (n.stumbledPoints as string[]) ?? [],
    }))
  },

  findByUser: async (userId) => {
    const result = await db
      .select({
        id: notes.id,
        userId: notes.userId,
        topicId: notes.topicId,
        sessionId: notes.sessionId,
        aiSummary: notes.aiSummary,
        userMemo: notes.userMemo,
        keyPoints: notes.keyPoints,
        stumbledPoints: notes.stumbledPoints,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        topicName: topics.name,
        subjectName: subjects.name,
      })
      .from(notes)
      .innerJoin(topics, eq(notes.topicId, topics.id))
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.createdAt))

    return result.map((n) => ({
      ...n,
      keyPoints: (n.keyPoints as string[]) ?? [],
      stumbledPoints: (n.stumbledPoints as string[]) ?? [],
    }))
  },

  update: async (id, data) => {
    const existing = await db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1)

    if (!existing[0]) return null

    const now = new Date()
    await db
      .update(notes)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(notes.id, id))

    return {
      ...existing[0],
      ...data,
      keyPoints: data.keyPoints ?? (existing[0].keyPoints as string[]) ?? [],
      stumbledPoints:
        data.stumbledPoints ?? (existing[0].stumbledPoints as string[]) ?? [],
      updatedAt: now,
    }
  },

  deleteById: async (id) => {
    const result = await db.delete(notes).where(eq(notes.id, id)).returning()
    return result.length > 0
  },
})
