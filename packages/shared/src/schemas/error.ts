import { z } from "zod"

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
})

export type ApiError = z.infer<typeof apiErrorSchema>
