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

export type SessionWithStats = {
  id: string
  userId: string
  topicId: string
  createdAt: Date
  updatedAt: Date
  messageCount: number
  goodCount: number
  surfaceCount: number
}

export type ChatRepository = {
  createSession: (data: { userId: string; topicId: string }) => Promise<ChatSession>
  findSessionById: (id: string) => Promise<ChatSession | null>
  findSessionsByTopic: (userId: string, topicId: string) => Promise<ChatSession[]>
  findSessionsWithStatsByTopic: (userId: string, topicId: string) => Promise<SessionWithStats[]>
  getSessionMessageCount: (sessionId: string) => Promise<number>
  getSessionQualityStats: (sessionId: string) => Promise<QuestionQualityStats>
  createMessage: (data: Omit<ChatMessage, "id" | "createdAt">) => Promise<ChatMessage>
  findMessageById: (id: string) => Promise<ChatMessage | null>
  findMessagesBySession: (sessionId: string) => Promise<ChatMessage[]>
  updateMessageQuality: (id: string, quality: string, reason?: string) => Promise<void>
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

  // N+1問題を解消: セッション一覧と統計を1クエリで取得
  findSessionsWithStatsByTopic: async (userId, topicId) => {
    const result = await db.all<{
      id: string
      userId: string
      topicId: string
      createdAt: number
      updatedAt: number
      messageCount: number
      goodCount: number
      surfaceCount: number
    }>(sql`
      SELECT
        s.id,
        s.user_id as userId,
        s.topic_id as topicId,
        s.created_at as createdAt,
        s.updated_at as updatedAt,
        COUNT(m.id) as messageCount,
        SUM(CASE WHEN m.question_quality = 'good' AND m.role = 'user' THEN 1 ELSE 0 END) as goodCount,
        SUM(CASE WHEN m.question_quality = 'surface' AND m.role = 'user' THEN 1 ELSE 0 END) as surfaceCount
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON s.id = m.session_id
      WHERE s.user_id = ${userId} AND s.topic_id = ${topicId}
      GROUP BY s.id
      HAVING COUNT(m.id) > 0
      ORDER BY s.created_at DESC
    `)

    return result.map((row) => ({
      id: row.id,
      userId: row.userId,
      topicId: row.topicId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      messageCount: row.messageCount,
      goodCount: row.goodCount,
      surfaceCount: row.surfaceCount,
    }))
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

  updateMessageQuality: async (id, quality, reason) => {
    await db
      .update(chatMessages)
      .set({
        questionQuality: quality,
        questionQualityReason: reason ?? null,
      })
      .where(eq(chatMessages.id, id))
  },
})
