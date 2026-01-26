import { z } from "zod"

// Note source type for UI display
export const noteSourceSchema = z.enum(["chat", "manual"])
export type NoteSource = z.infer<typeof noteSourceSchema>

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

// Note with source (derived from sessionId)
export const noteWithSourceSchema = noteSchema.extend({
  source: noteSourceSchema,
})

export type NoteWithSource = z.infer<typeof noteWithSourceSchema>

// Request schemas

// セッションからノート作成（既存）
export const createNoteFromSessionRequestSchema = z.object({
  sessionId: z.string(),
})

export type CreateNoteFromSessionRequest = z.infer<typeof createNoteFromSessionRequestSchema>

// 独立ノート作成（新規）
export const createManualNoteRequestSchema = z.object({
  topicId: z.string(),
  userMemo: z.string().min(1, "本文は必須です").max(10000, "本文は10000文字以内で入力してください"),
  keyPoints: z
    .array(z.string().min(1).max(1000))
    .max(50)
    .optional()
    .default([]),
  stumbledPoints: z
    .array(z.string().min(1).max(1000))
    .max(50)
    .optional()
    .default([]),
})

export type CreateManualNoteRequest = z.infer<typeof createManualNoteRequestSchema>

// 後方互換のためのエイリアス
export const createNoteRequestSchema = createNoteFromSessionRequestSchema

export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>

export const updateNoteRequestSchema = z.object({
  userMemo: z.string().max(50000).optional(),
  keyPoints: z.array(z.string().max(1000)).max(50).optional(),
  stumbledPoints: z.array(z.string().max(1000)).max(50).optional(),
})

export type UpdateNoteRequest = z.infer<typeof updateNoteRequestSchema>

// Response schemas
export const noteResponseSchema = noteSchema

export const notesResponseSchema = z.array(noteSchema)
