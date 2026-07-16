import { describe, expect, it } from "vitest"
import { decodeAccessTokenUser } from "./jwt"

const encodePayload = (payload: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

describe("decodeAccessTokenUser", () => {
  it("paddingのないBase64URLとUTF-8の利用者名を復号する", () => {
    const token = `header.${encodePayload({
      sub: "user-1",
      email: "user@example.com",
      name: "山田太郎",
      avatarUrl: null,
    })}.signature`

    expect(decodeAccessTokenUser(token)).toEqual({
      id: "user-1",
      email: "user@example.com",
      displayName: "山田太郎",
      avatarUrl: null,
    })
  })

  it("必須claimがないJWTを拒否する", () => {
    const token = `header.${encodePayload({ sub: "user-1" })}.signature`
    expect(() => decodeAccessTokenUser(token)).toThrow()
  })
})
