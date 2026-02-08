import { z } from "zod"

export const studyDomainSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  emoji: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
})

export type StudyDomain = z.infer<typeof studyDomainSchema>

// Request schemas
export const createStudyDomainRequestSchema = z.object({
  name: z.string().min(1, "名前は必須です").max(100, "名前は100文字以内で入力してください"),
  description: z.string().max(500, "説明は500文字以内で入力してください").optional(),
  emoji: z.string().max(10).optional(),
  color: z.string().max(50).optional(),
})

export type CreateStudyDomainRequest = z.infer<typeof createStudyDomainRequestSchema>

export const updateStudyDomainRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
})

export type UpdateStudyDomainRequest = z.infer<typeof updateStudyDomainRequestSchema>

// Response schemas
export const studyDomainResponseSchema = studyDomainSchema.omit({ deletedAt: true })

export type StudyDomainResponse = z.infer<typeof studyDomainResponseSchema>

export const studyDomainsResponseSchema = z.array(studyDomainResponseSchema)

// API response wrapper schemas
export const studyDomainListResponseSchema = z.object({
  studyDomains: studyDomainsResponseSchema,
})

export type StudyDomainListResponse = z.infer<typeof studyDomainListResponseSchema>

export const studyDomainSingleResponseSchema = z.object({
  studyDomain: studyDomainResponseSchema,
})

export type StudyDomainSingleResponse = z.infer<typeof studyDomainSingleResponseSchema>

// Bulk CSV import response
export const bulkCSVImportResponseSchema = z.object({
  success: z.boolean(),
  imported: z.object({
    subjects: z.number(),
    categories: z.number(),
    subcategories: z.number(),
    topics: z.number(),
  }),
  errors: z.array(z.object({
    line: z.number(),
    message: z.string(),
  })),
})

export type BulkCSVImportResponse = z.infer<typeof bulkCSVImportResponseSchema>
