import { describe, expect, it } from "vitest"
import { getVerifiedGoogleProfile } from "./google"

describe("getVerifiedGoogleProfile", () => {
  it("確認済みメールのprofileを返す", () => {
    expect(getVerifiedGoogleProfile({
      sub: "google-1",
      email: "user@example.com",
      email_verified: true,
      name: "User",
    })).toEqual({
      providerId: "google-1",
      email: "user@example.com",
      name: "User",
      avatarUrl: null,
    })
  })

  it("未確認メールを拒否する", () => {
    expect(() => getVerifiedGoogleProfile({
      sub: "google-1",
      email: "user@example.com",
      email_verified: false,
    })).toThrow(/unverified/)
  })
})
