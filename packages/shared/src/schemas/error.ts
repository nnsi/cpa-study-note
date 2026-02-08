import { z } from "zod"

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>

// Common response schemas
export const successResponseSchema = z.object({
  success: z.boolean(),
})

export type SuccessResponse = z.infer<typeof successResponseSchema>

export const messageResponseSchema = z.object({
  message: z.string(),
})

export type MessageResponse = z.infer<typeof messageResponseSchema>
