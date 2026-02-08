import { eq, and, desc, sql, inArray } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import {
  chatSessions,
  chatMessages,
  topics,
  categories,
  subjects,
  studyDomains,
} from "@cpa-study/db/schema"
import type { MessageRole, QuestionQuality } from "@cpa-study/shared/schemas"

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
  role: MessageRole
  content: string
  imageId: string | null
  ocrResult: string | null
  questionQuality: QuestionQuality
  createdAt: Date
}

export type QuestionQualityStats = {
  goodCount: number
  surfaceCount: number
}

export type TopicWithHierarchy = {
  topic: {
    id: string
    name: string
    aiSystemPrompt: string | null
  }
  category: {
    id: string
    name: string
  }
  subject: {
    id: string
    name: string
  }
  studyDomain: {
    id: string
    name: string
  }
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
  firstMessagePreview: string | null
}

export type GoodQuestion = {
  id: string
  sessionId: string
  content: string
  createdAt: Date
}

export type ContextMessage = {
  role: string
  content: string
  ocrResult: string | null
}

export type ChatRepository = {
  createSession: (data: { userId: string; topicId: string }) => Promise<ChatSession>
  findSessionById: (id: string) => Promise<ChatSession | null>
  findSessionsByTopic: (userId: string, topicId: string) => Promise<ChatSession[]>
  findSessionsWithStatsByTopic: (userId: string, topicId: string) => Promise<SessionWithStats[]>
  getSessionMessageCount: (sessionId: string) => Promise<number>
  getSessionQualityStats: (sessionId: string) => Promise<QuestionQualityStats>
  getTopicWithHierarchy: (topicId: string) => Promise<TopicWithHierarchy | null>
  createMessage: (data: Omit<ChatMessage, "id" | "createdAt">) => Promise<ChatMessage>
  findMessageById: (id: string) => Promise<ChatMessage | null>
  findMessagesBySession: (sessionId: string) => Promise<ChatMessage[]>
  findRecentMessagesForContext: (sessionId: string, limit?: number) => Promise<ContextMessage[]>
  updateMessageQuality: (id: string, quality: string, reason?: string) => Promise<void>
  findGoodQuestionsByTopic: (userId: string, topicId: string) => Promise<GoodQuestion[]>
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

  // セッション一覧と統計を取得（2クエリで実装）
  findSessionsWithStatsByTopic: async (userId, topicId) => {
    // 1. セッション一覧と統計を取得
    const sessionsWithStats = await db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
        topicId: chatSessions.topicId,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
        messageCount: sql<number>`count(${chatMessages.id})`,
        goodCount: sql<number>`sum(case when ${chatMessages.questionQuality} = 'good' and ${chatMessages.role} = 'user' then 1 else 0 end)`,
        surfaceCount: sql<number>`sum(case when ${chatMessages.questionQuality} = 'surface' and ${chatMessages.role} = 'user' then 1 else 0 end)`,
      })
      .from(chatSessions)
      .leftJoin(chatMessages, eq(chatSessions.id, chatMessages.sessionId))
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.topicId, topicId)
        )
      )
      .groupBy(chatSessions.id)
      .having(sql`count(${chatMessages.id}) > 0`)
      .orderBy(desc(chatSessions.createdAt))

    if (sessionsWithStats.length === 0) {
      return []
    }

    // 2. 各セッションの最初のユーザーメッセージを取得
    const sessionIds = sessionsWithStats.map((s) => s.id)
    const firstMessages = await db
      .select({
        sessionId: chatMessages.sessionId,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(
        and(
          inArray(chatMessages.sessionId, sessionIds),
          eq(chatMessages.role, "user")
        )
      )
      .orderBy(chatMessages.createdAt)

    // セッションIDごとに最初のメッセージをマップ化（最初に見つかったものを採用）
    const firstMessageMap = new Map<string, string>()
    for (const msg of firstMessages) {
      if (!firstMessageMap.has(msg.sessionId)) {
        firstMessageMap.set(msg.sessionId, msg.content.slice(0, 50))
      }
    }

    return sessionsWithStats.map((session) => ({
      id: session.id,
      userId: session.userId,
      topicId: session.topicId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount ?? 0,
      goodCount: session.goodCount ?? 0,
      surfaceCount: session.surfaceCount ?? 0,
      firstMessagePreview: firstMessageMap.get(session.id) ?? null,
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

  getTopicWithHierarchy: async (topicId) => {
    const result = await db
      .select({
        topicId: topics.id,
        topicName: topics.name,
        topicAiSystemPrompt: topics.aiSystemPrompt,
        categoryId: categories.id,
        categoryName: categories.name,
        subjectId: subjects.id,
        subjectName: subjects.name,
        studyDomainId: studyDomains.id,
        studyDomainName: studyDomains.name,
      })
      .from(topics)
      .innerJoin(categories, eq(topics.categoryId, categories.id))
      .innerJoin(subjects, eq(categories.subjectId, subjects.id))
      .innerJoin(studyDomains, eq(subjects.studyDomainId, studyDomains.id))
      .where(eq(topics.id, topicId))
      .limit(1)

    const row = result[0]
    if (!row) {
      return null
    }

    return {
      topic: {
        id: row.topicId,
        name: row.topicName,
        aiSystemPrompt: row.topicAiSystemPrompt,
      },
      category: {
        id: row.categoryId,
        name: row.categoryName,
      },
      subject: {
        id: row.subjectId,
        name: row.subjectName,
      },
      studyDomain: {
        id: row.studyDomainId,
        name: row.studyDomainName,
      },
    }
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
    const row = result[0]
    if (!row) return null
    return {
      id: row.id,
      sessionId: row.sessionId,
      role: row.role as MessageRole,
      content: row.content,
      imageId: row.imageId,
      ocrResult: row.ocrResult,
      questionQuality: row.questionQuality as QuestionQuality,
      createdAt: row.createdAt,
    }
  },

  findMessagesBySession: async (sessionId) => {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt)
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      role: row.role as MessageRole,
      content: row.content,
      imageId: row.imageId,
      ocrResult: row.ocrResult,
      questionQuality: row.questionQuality as QuestionQuality,
      createdAt: row.createdAt,
    }))
  },

  // AI context構築用: 必要カラムのみ取得・最新N件に制限
  findRecentMessagesForContext: async (sessionId, limit = 20) => {
    const rows = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
        ocrResult: chatMessages.ocrResult,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
    // 降順で取得したので昇順に戻す
    return rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
      ocrResult: row.ocrResult,
    }))
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

  // トピックに紐づくgood質問を一括取得
  findGoodQuestionsByTopic: async (userId: string, topicId: string) => {
    return db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.topicId, topicId),
          eq(chatMessages.role, "user"),
          eq(chatMessages.questionQuality, "good")
        )
      )
      .orderBy(desc(chatMessages.createdAt))
  },
})
