import { z } from "zod"

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type User = z.infer<typeof userSchema>

export const userResponseSchema = userSchema

export const oauthConnectionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: z.string(),
  providerId: z.string(),
  createdAt: z.string().datetime(),
})

export type OAuthConnection = z.infer<typeof oauthConnectionSchema>
