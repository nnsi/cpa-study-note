import { z } from "zod"

const accessTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
})

export type AccessTokenUser = {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

export const decodeAccessTokenUser = (token: string): AccessTokenUser => {
  const encodedPayload = token.split(".")[1]
  if (!encodedPayload) throw new Error("JWT payload is missing")

  const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const decoded = atob(padded)
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
  const payload = accessTokenPayloadSchema.parse(
    JSON.parse(new TextDecoder().decode(bytes))
  )

  return {
    id: payload.sub,
    email: payload.email,
    displayName: payload.name ?? null,
    avatarUrl: payload.avatarUrl ?? null,
  }
}
