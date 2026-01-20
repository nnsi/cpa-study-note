import { z } from "zod"

export const noteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  topicId: z.string(),
  sessionId: z.string().nullable(),
  aiSummary: z.string().nullable(),
  userMemo: z.string().nullable(),
  keyPoints: z.array(z.string()),
  stumbledPoints: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Note = z.infer<typeof noteSchema>

// Request schemas
export const createNoteRequestSchema = z.object({
  sessionId: z.string(),
})

export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>

export const updateNoteRequestSchema = z.object({
  userMemo: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
  stumbledPoints: z.array(z.string()).optional(),
})

export type UpdateNoteRequest = z.infer<typeof updateNoteRequestSchema>

// Response schemas
export const noteResponseSchema = noteSchema

export const notesResponseSchema = z.array(noteSchema)
