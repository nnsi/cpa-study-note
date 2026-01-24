import { z } from "zod"

export const imageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  r2Key: z.string(),
  ocrText: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export type Image = z.infer<typeof imageSchema>

// Allowed MIME types for image upload
export const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const

export type AllowedMimeType = (typeof allowedMimeTypes)[number]

// Request schemas
export const uploadImageRequestSchema = z.object({
  filename: z.string().max(255),
  mimeType: z.enum(allowedMimeTypes),
})

export type UploadImageRequest = z.infer<typeof uploadImageRequestSchema>

// Response schemas
export const imageResponseSchema = imageSchema

export const uploadUrlResponseSchema = z.object({
  uploadUrl: z.string(),
  imageId: z.string(),
})

export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>

export const ocrResultResponseSchema = z.object({
  imageId: z.string(),
  ocrText: z.string(),
})

export type OcrResultResponse = z.infer<typeof ocrResultResponseSchema>
