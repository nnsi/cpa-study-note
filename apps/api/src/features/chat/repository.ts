import { eq, and, desc, sql } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { chatSessions, chatMessages } from "@cpa-study/db/schema"

export type ChatSession = {
  id: string
  userId: string
  topicId: string
  createdAt: Date
  updatedAt: Date
}

export type ChatMessage = {
  id: string
  sessionId: string
  role: string
  content: string
  imageId: string | null
  ocrResult: string | null
  questionQuality: string | null
  createdAt: Date
}

export type QuestionQualityStats = {
  goodCount: number
  surfaceCount: number
}

export type ChatRepository = {
  createSession: (data: { userId: string; topicId: string }) => Promise<ChatSession>
  findSessionById: (id: string) => Promise<ChatSession | null>
  findSessionsByTopic: (userId: string, topicId: string) => Promise<ChatSession[]>
  getSessionMessageCount: (sessionId: string) => Promise<number>
  getSessionQualityStats: (sessionId: string) => Promise<QuestionQualityStats>
  createMessage: (data: Omit<ChatMessage, "id" | "createdAt">) => Promise<ChatMessage>
  findMessageById: (id: string) => Promise<ChatMessage | null>
  findMessagesBySession: (sessionId: string) => Promise<ChatMessage[]>
  updateMessageQuality: (id: string, quality: string) => Promise<void>
}

export const createChatRepository = (db: Db): ChatRepository => ({
  createSession: async ({ userId, topicId }) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(chatSessions).values({
      id,
      userId,
      topicId,
      createdAt: now,
      updatedAt: now,
    })

    return { id, userId, topicId, createdAt: now, updatedAt: now }
  },

  findSessionById: async (id) => {
    const result = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, id))
      .limit(1)
    return result[0] ?? null
  },

  findSessionsByTopic: async (userId, topicId) => {
    return db
      .select()
      .from(chatSessions)
      .where(
        and(eq(chatSessions.userId, userId), eq(chatSessions.topicId, topicId))
      )
      .orderBy(desc(chatSessions.createdAt))
  },

  getSessionMessageCount: async (sessionId) => {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
    return result[0]?.count ?? 0
  },

  getSessionQualityStats: async (sessionId) => {
    const result = await db
      .select({
        quality: chatMessages.questionQuality,
        count: sql<number>`count(*)`,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          eq(chatMessages.role, "user")
        )
      )
      .groupBy(chatMessages.questionQuality)

    let goodCount = 0
    let surfaceCount = 0

    for (const row of result) {
      if (row.quality === "good") {
        goodCount = row.count
      } else if (row.quality === "surface") {
        surfaceCount = row.count
      }
    }

    return { goodCount, surfaceCount }
  },

  createMessage: async (data) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(chatMessages).values({
      id,
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
      imageId: data.imageId,
      ocrResult: data.ocrResult,
      questionQuality: data.questionQuality,
      createdAt: now,
    })

    return { id, ...data, createdAt: now }
  },

  findMessageById: async (id) => {
    const result = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .limit(1)
    return result[0] ?? null
  },

  findMessagesBySession: async (sessionId) => {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt)
  },

  updateMessageQuality: async (id, quality) => {
    await db
      .update(chatMessages)
      .set({ questionQuality: quality })
      .where(eq(chatMessages.id, id))
  },
})
