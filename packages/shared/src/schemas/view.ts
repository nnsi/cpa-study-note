import { z } from "zod"

// Review list query
export const reviewListQuerySchema = z.object({
  understood: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  daysSince: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>

// Search query
export const searchQuerySchema = z.object({
  q: z.string().min(1),
  studyDomainId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>
