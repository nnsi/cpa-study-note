import { z } from "zod"

export const studyDomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  emoji: z.string().nullable(),
  color: z.string().nullable(),
  isPublic: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type StudyDomain = z.infer<typeof studyDomainSchema>

// Request schemas
export const createStudyDomainRequestSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "IDは小文字英数字とハイフンのみ使用できます"),
  name: z.string().min(1, "名前は必須です").max(100, "名前は100文字以内で入力してください"),
  description: z.string().max(1000, "説明は1000文字以内で入力してください").optional(),
  emoji: z.string().max(10).optional(),
  color: z.string().max(50).optional(),
  isPublic: z.boolean().optional().default(true),
})

export type CreateStudyDomainRequest = z.infer<typeof createStudyDomainRequestSchema>

export const updateStudyDomainRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  isPublic: z.boolean().optional(),
})

export type UpdateStudyDomainRequest = z.infer<typeof updateStudyDomainRequestSchema>

// Response schemas
export const studyDomainResponseSchema = studyDomainSchema

export const studyDomainsResponseSchema = z.array(studyDomainSchema)

// User-StudyDomain relation schemas
export const userStudyDomainSchema = z.object({
  id: z.string(),
  userId: z.string(),
  studyDomainId: z.string(),
  joinedAt: z.string().datetime(),
})

export type UserStudyDomain = z.infer<typeof userStudyDomainSchema>

export const userStudyDomainResponseSchema = userStudyDomainSchema.extend({
  studyDomain: studyDomainSchema,
})

export type UserStudyDomainResponse = z.infer<typeof userStudyDomainResponseSchema>

export const userStudyDomainsResponseSchema = z.array(userStudyDomainResponseSchema)
