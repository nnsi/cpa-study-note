import { eq, desc } from "drizzle-orm"
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

export type ChatRepository = {
  createSession: (data: { userId: string; topicId: string }) => Promise<ChatSession>
  findSessionById: (id: string) => Promise<ChatSession | null>
  findSessionsByTopic: (userId: string, topicId: string) => Promise<ChatSession[]>
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
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.createdAt))
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
