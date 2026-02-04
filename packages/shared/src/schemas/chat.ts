import { z } from "zod"

export const messageRoleSchema = z.enum(["user", "assistant", "system"])
export type MessageRole = z.infer<typeof messageRoleSchema>

export const questionQualitySchema = z.enum(["good", "surface"]).nullable()
export type QuestionQuality = z.infer<typeof questionQualitySchema>

export const chatSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  topicId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ChatSession = z.infer<typeof chatSessionSchema>

export const chatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  imageId: z.string().nullable(),
  ocrResult: z.string().nullable(),
  questionQuality: questionQualitySchema,
  createdAt: z.string().datetime(),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>

// Request schemas
export const createSessionRequestSchema = z.object({
  topicId: z.string(),
})

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>

export const sendMessageRequestSchema = z.object({
  content: z.string().min(1).max(10000),
  imageId: z.string().optional(),
  ocrResult: z.string().max(50000).optional(),
})

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>

// Chat SSE Stream chunk types (includes session_created for new session flow)
export const chatStreamChunkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({ type: z.literal("done"), messageId: z.string().optional() }),
  z.object({ type: z.literal("error"), error: z.string() }),
  z.object({ type: z.literal("session_created"), sessionId: z.string() }),
])

export type ChatStreamChunk = z.infer<typeof chatStreamChunkSchema>

// Response schemas
export const chatSessionResponseSchema = chatSessionSchema

export const chatMessageResponseSchema = chatMessageSchema

export const chatMessagesResponseSchema = z.array(chatMessageSchema)

// API response wrapper (for { messages: [...] } format)
export const chatMessagesWrapperResponseSchema = z.object({
  messages: z.array(chatMessageSchema),
})

export type ChatMessagesWrapperResponse = z.infer<typeof chatMessagesWrapperResponseSchema>

// Good question response (for N+1 batch fetch)
export const goodQuestionResponseSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
})

export type GoodQuestionResponse = z.infer<typeof goodQuestionResponseSchema>

// 深掘り質問一覧レスポンス
export const goodQuestionsListResponseSchema = z.object({
  questions: z.array(goodQuestionResponseSchema),
})

export type GoodQuestionsListResponse = z.infer<typeof goodQuestionsListResponseSchema>

// セッション + 統計情報
export const sessionWithStatsSchema = chatSessionSchema.extend({
  messageCount: z.number(),
  goodCount: z.number(),
  surfaceCount: z.number(),
  firstMessagePreview: z.string().nullable(),
})

export type SessionWithStats = z.infer<typeof sessionWithStatsSchema>

// セッション一覧レスポンス
export const sessionsListResponseSchema = z.object({
  sessions: z.array(sessionWithStatsSchema),
})

export type SessionsListResponse = z.infer<typeof sessionsListResponseSchema>
