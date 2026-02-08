/// <reference types="@cloudflare/workers-types" />
/**
 * E2E: 認証フロー
 *
 * テスト対象:
 * - Google OAuth開始 -> コールバック -> トークン取得
 * - トークンリフレッシュ -> 新トークン取得
 * - ログアウト -> トークン無効化確認
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { z } from "zod"
import { setupTestEnv, cleanupTestEnv, type TestContext } from "./helpers"

// Zod schemas for response validation
const providersResponseSchema = z.object({
  providers: z.array(z.string()),
})

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

const authUserSchema = z.object({
  id: z.string(),
})

const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
})

const meResponseSchema = z.object({
  user: authUserSchema,
})

const logoutResponseSchema = z.object({
  success: z.boolean(),
})

describe("E2E: Auth Flow", () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = setupTestEnv()
  })

  afterAll(() => {
    cleanupTestEnv(ctx)
  })

  describe("OAuth Flow", () => {
    it("should return available providers", async () => {
      const res = await ctx.app.request("/api/auth/providers", {
        method: "GET",
      }, ctx.env)

      expect(res.status).toBe(200)
      const data = providersResponseSchema.parse(await res.json())
      expect(data.providers).toContain("google")
    })

    it("should redirect to Google OAuth on /api/auth/google", async () => {
      const res = await ctx.app.request("/api/auth/google", {
        method: "GET",
      }, ctx.env)

      // OAuth開始時はGoogleにリダイレクト
      expect(res.status).toBe(302)
      const location = res.headers.get("Location")
      expect(location).toContain("accounts.google.com")
      expect(location).toContain("client_id=test-google-client-id")
    })

    it("should fail callback without code", async () => {
      const res = await ctx.app.request("/api/auth/google/callback", {
        method: "GET",
      }, ctx.env)

      expect(res.status).toBe(400)
      const data = errorResponseSchema.parse(await res.json())
      expect(data.error.message).toBe("Missing code")
    })

    it("should fail callback with invalid state", async () => {
      const res = await ctx.app.request("/api/auth/google/callback?code=test&state=invalid", {
        method: "GET",
      }, ctx.env)

      expect(res.status).toBe(400)
      const data = errorResponseSchema.parse(await res.json())
      expect(data.error.message).toBe("Invalid state")
    })

    // Note: Full OAuth callback success flow is tested at the route level
    // with mocked providers. E2E tests use dev-login as the equivalent
    // authentication flow for the local environment.
    it("should complete auth flow via dev-login (equivalent to OAuth success)", async () => {
      // Step 1: Get dev login tokens (equivalent to OAuth callback success)
      const loginRes = await ctx.app.request("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, ctx.env)

      expect(loginRes.status).toBe(200)
      const loginData = loginResponseSchema.parse(await loginRes.json())
      expect(loginData.accessToken).toBeDefined()
      expect(loginData.user).toBeDefined()

      // Step 2: Extract refresh token from cookie
      const setCookie = loginRes.headers.get("Set-Cookie")
      const match = setCookie?.match(/refresh_token=([^;]+)/)
      const refreshToken = match ? match[1] : null
      expect(refreshToken).toBeDefined()

      // Step 3: Use access token to get user info (simulates authenticated request)
      const meRes = await ctx.app.request("/api/auth/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${loginData.accessToken}`,
        },
      }, ctx.env)

      expect(meRes.status).toBe(200)
      const meData = meResponseSchema.parse(await meRes.json())
      expect(meData.user.id).toBe(loginData.user.id)

      // Step 4: Refresh token flow (part of complete auth cycle)
      const refreshRes = await ctx.app.request("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `refresh_token=${refreshToken}`,
        },
      }, ctx.env)

      expect(refreshRes.status).toBe(200)
      const refreshData = loginResponseSchema.parse(await refreshRes.json())
      expect(refreshData.accessToken).toBeDefined()
      expect(refreshData.user.id).toBe(loginData.user.id)
    })
  })

  describe("Dev Login (local environment only)", () => {
    it("should allow dev login in local environment", async () => {
      const res = await ctx.app.request("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, ctx.env)

      expect(res.status).toBe(200)
      const data = loginResponseSchema.parse(await res.json())
      expect(data.accessToken).toBeDefined()
      expect(data.user).toBeDefined()
      expect(data.user.id).toBe(ctx.testData.userId)

      // Refresh token should be set in cookie
      const setCookie = res.headers.get("Set-Cookie")
      expect(setCookie).toContain("refresh_token=")
    })

  })

  describe("Token Refresh Flow", () => {
    let refreshToken: string | null = null

    it("should get tokens via dev login", async () => {
      const res = await ctx.app.request("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, ctx.env)

      expect(res.status).toBe(200)

      // Extract refresh token from Set-Cookie header
      const setCookie = res.headers.get("Set-Cookie")
      const match = setCookie?.match(/refresh_token=([^;]+)/)
      refreshToken = match ? match[1] : null
      expect(refreshToken).toBeDefined()
    })

    it("should refresh access token with valid refresh token", async () => {
      expect(refreshToken).not.toBeNull()

      const res = await ctx.app.request("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `refresh_token=${refreshToken}`,
        },
      }, ctx.env)

      expect(res.status).toBe(200)
      const data = loginResponseSchema.parse(await res.json())
      expect(data.accessToken).toBeDefined()
      expect(data.user).toBeDefined()
    })

    it("should fail refresh without refresh token", async () => {
      const res = await ctx.app.request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, ctx.env)

      expect(res.status).toBe(401)
      const data = errorResponseSchema.parse(await res.json())
      expect(data.error.message).toBe("No refresh token")
    })

    it("should fail refresh with invalid refresh token", async () => {
      const res = await ctx.app.request("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": "refresh_token=invalid-token-12345",
        },
      }, ctx.env)

      expect(res.status).toBe(401)
    })
  })

  describe("Logout Flow", () => {
    let refreshToken: string | null = null

    it("should login and get refresh token", async () => {
      const res = await ctx.app.request("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, ctx.env)

      expect(res.status).toBe(200)

      const setCookie = res.headers.get("Set-Cookie")
      const match = setCookie?.match(/refresh_token=([^;]+)/)
      refreshToken = match ? match[1] : null
      expect(refreshToken).toBeDefined()
    })

    it("should logout and invalidate refresh token", async () => {
      expect(refreshToken).not.toBeNull()

      const res = await ctx.app.request("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `refresh_token=${refreshToken}`,
        },
      }, ctx.env)

      expect(res.status).toBe(200)
      const data = logoutResponseSchema.parse(await res.json())
      expect(data.success).toBe(true)

      // Cookie should be cleared
      const setCookie = res.headers.get("Set-Cookie")
      expect(setCookie).toContain("refresh_token=")
      expect(setCookie).toContain("Max-Age=0")
    })

    it("should fail to refresh after logout", async () => {
      expect(refreshToken).not.toBeNull()

      const res = await ctx.app.request("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `refresh_token=${refreshToken}`,
        },
      }, ctx.env)

      // Token should be invalid after logout
      expect(res.status).toBe(401)
    })
  })

  describe("Get Current User", () => {
    it("should return user info in local environment", async () => {
      const res = await ctx.app.request("/api/auth/me", {
        method: "GET",
        headers: {
          "X-Dev-User-Id": ctx.testData.userId,
        },
      }, ctx.env)

      expect(res.status).toBe(200)
      const data = meResponseSchema.parse(await res.json())
      expect(data.user).toBeDefined()
      expect(data.user.id).toBe(ctx.testData.userId)
    })
  })
})
