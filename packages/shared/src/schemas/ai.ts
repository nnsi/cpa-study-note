import { z } from "zod"

export const streamChunkTypeSchema = z.enum(["text", "error", "done"])
export type StreamChunkType = z.infer<typeof streamChunkTypeSchema>

export const streamChunkSchema = z.object({
  type: streamChunkTypeSchema,
  content: z.string().optional(),
  error: z.string().optional(),
})

export type StreamChunk = z.infer<typeof streamChunkSchema>

export const aiMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
  imageUrl: z.string().optional(),
})

export type AIMessage = z.infer<typeof aiMessageSchema>
