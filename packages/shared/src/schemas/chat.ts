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
  content: z.string().min(1),
  imageId: z.string().optional(),
})

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>

// Response schemas
export const chatSessionResponseSchema = chatSessionSchema

export const chatMessageResponseSchema = chatMessageSchema

export const chatMessagesResponseSchema = z.array(chatMessageSchema)
