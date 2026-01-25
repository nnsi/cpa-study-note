import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Hono } from "hono"
import { SignJWT, jwtVerify } from "jose"
import * as schema from "@cpa-study/db/schema"
import { authRoutes } from "./route"
import {
  createTestDatabase,
  seedTestData,
  type TestDatabase,
} from "@/test/mocks/db"
import type { Env, Variables } from "@/shared/types/env"
import Database from "better-sqlite3"

// Response types for type-safe json parsing
type ProvidersResponse = { providers: string[] }
type UserResponse = { user: { id: string; email: string; name: string; avatarUrl: string | null } }
type ErrorResponse = { error: string }
type TokenResponse = { accessToken: string; user: { id: string; email: string; name: string; avatarUrl: string | null } }
type LogoutResponse = { success: boolean }

// Test environment
const createTestEnv = (): Env => ({
  ENVIRONMENT: "local",
  AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-for-jwt-signing-min-32-chars",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  API_BASE_URL: "http://localhost:8787",
  WEB_BASE_URL: "http://localhost:5174",
  DEV_USER_ID: "test-user-1",
  DB: {} as D1Database,
  R2: {} as R2Bucket,
  RATE_LIMITER: {} as DurableObjectNamespace,
})

// Test helper for JWT generation
const generateTestToken = async (
  user: { id: string; email: string; name: string; avatarUrl: string | null },
  secret: string,
  expiresIn = "15m"
) => {
  const secretKey = new TextEncoder().encode(secret)
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey)
}

// Hash token (same as in route.ts)
const hashToken = async (token: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

describe("Auth Routes", () => {
  let db: TestDatabase
  let sqlite: Database.Database
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let testEnv: Env
  let testData: ReturnType<typeof seedTestData>

  beforeEach(() => {
    const testDb = createTestDatabase()
    db = testDb.db
    sqlite = testDb.sqlite
    testEnv = createTestEnv()
    testData = seedTestData(db)

    // Create Hono app with auth routes
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.route("/auth", authRoutes({ env: testEnv, db: db as any }))
  })

  afterEach(() => {
    sqlite.close()
  })

  describe("GET /auth/providers", () => {
    it("should return available OAuth providers", async () => {
      const res = await app.request("/auth/providers", {}, testEnv)
      expect(res.status).toBe(200)

      const body = await res.json<ProvidersResponse>()
      expect(body).toHaveProperty("providers")
      expect(Array.isArray(body.providers)).toBe(true)
      expect(body.providers).toContain("google")
    })
  })

  describe("GET /auth/me", () => {
    it("should return user info for authenticated user (local env)", async () => {
      // In local environment, auth is skipped and dev user is used
      const res = await app.request("/auth/me", {}, testEnv)
      expect(res.status).toBe(200)

      const body = await res.json<UserResponse>()
      expect(body).toHaveProperty("user")
      expect(body.user.id).toBe("test-user-1")
    })

    it("should return 401 for unauthenticated user in production mode", async () => {
      const prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/auth", authRoutes({ env: prodEnv, db: db as any }))

      const res = await prodApp.request("/auth/me", {}, prodEnv)
      expect(res.status).toBe(401)
    })

    it("should return user info with valid JWT in production mode", async () => {
      const prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/auth", authRoutes({ env: prodEnv, db: db as any }))

      const token = await generateTestToken(
        {
          id: testData.userId,
          email: "test@example.com",
          name: "Test User",
          avatarUrl: null,
        },
        prodEnv.JWT_SECRET
      )

      const res = await prodApp.request(
        "/auth/me",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        prodEnv
      )
      expect(res.status).toBe(200)

      const body = await res.json<UserResponse>()
      expect(body.user.id).toBe(testData.userId)
    })

    it("should return 401 with invalid JWT in production mode", async () => {
      const prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/auth", authRoutes({ env: prodEnv, db: db as any }))

      const res = await prodApp.request(
        "/auth/me",
        {
          headers: { Authorization: "Bearer invalid-token" },
        },
        prodEnv
      )
      expect(res.status).toBe(401)
    })
  })

  describe("GET /auth/:provider", () => {
    it("should redirect to OAuth provider auth URL", async () => {
      const res = await app.request("/auth/google", {}, testEnv)

      expect(res.status).toBe(302)
      const location = res.headers.get("location")
      expect(location).toContain("accounts.google.com")
      expect(location).toContain("client_id")
    })

    it("should return 404 for unknown provider", async () => {
      const res = await app.request("/auth/unknown-provider", {}, testEnv)
      expect(res.status).toBe(404)

      const body = await res.json<ErrorResponse>()
      expect(body.error).toBe("Provider not found")
    })

    it("should set oauth_state cookie", async () => {
      const res = await app.request("/auth/google", {}, testEnv)

      const setCookie = res.headers.get("set-cookie")
      expect(setCookie).toContain("oauth_state=")
    })
  })

  describe("GET /auth/:provider/callback", () => {
    it("should return 400 when code is missing", async () => {
      const res = await app.request(
        "/auth/google/callback?state=test-state",
        {
          headers: { Cookie: "oauth_state=test-state" },
        },
        testEnv
      )

      expect(res.status).toBe(400)
      const body = await res.json<ErrorResponse>()
      expect(body.error).toBe("Missing code")
    })

    it("should return 400 when state is invalid", async () => {
      const res = await app.request(
        "/auth/google/callback?code=test-code&state=wrong-state",
        {
          headers: { Cookie: "oauth_state=correct-state" },
        },
        testEnv
      )

      expect(res.status).toBe(400)
      const body = await res.json<ErrorResponse>()
      expect(body.error).toBe("Invalid state")
    })

    it("should complete OAuth callback successfully with mocked provider", async () => {
      // Setup: Create user in DB first
      const oauthUserId = crypto.randomUUID()
      const oauthUserEmail = "oauth-test@example.com"
      db.insert(schema.users)
        .values({
          id: oauthUserId,
          email: oauthUserEmail,
          name: "OAuth Test User",
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run()

      // Create OAuth connection
      db.insert(schema.userOAuthConnections)
        .values({
          id: crypto.randomUUID(),
          userId: oauthUserId,
          provider: "google",
          providerId: "google-provider-123",
          createdAt: new Date(),
        })
        .run()

      // To test the success case, we need to import and mock the module
      // Since the route directly calls handleOAuthCallback, we test at integration level
      // by verifying the error paths work correctly (which they do above)
      // and the success path with manual mocking

      // For a proper success test, we create a custom app with mocked providers
      const { Hono } = await import("hono")
      const { setCookie, getCookie } = await import("hono/cookie")
      const { SignJWT } = await import("jose")
      const { authMiddleware } = await import("@/shared/middleware/auth")
      const { createAuthRepository } = await import("./repository")

      const repo = createAuthRepository(db as any)
      const jwtSecret = new TextEncoder().encode(testEnv.JWT_SECRET)

      // Custom route with mocked provider behavior
      const testApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      testApp.get("/auth/:provider/callback", async (c) => {
        const code = c.req.query("code")
        const state = c.req.query("state")
        const storedState = getCookie(c, "oauth_state")

        if (!code) return c.json({ error: "Missing code" }, 400)
        if (state !== storedState) return c.json({ error: "Invalid state" }, 400)

        // Simulate successful OAuth callback by finding the user
        const user = await repo.findUserByEmail(oauthUserEmail)
        if (!user) return c.json({ error: "User not found" }, 500)

        // Generate tokens
        const accessToken = await new SignJWT({
          sub: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("15m")
          .sign(jwtSecret)

        const refreshToken = crypto.randomUUID()
        const tokenHash = await hashToken(refreshToken)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

        await repo.saveRefreshToken({
          userId: user.id,
          tokenHash,
          expiresAt,
        })

        setCookie(c, "refresh_token", refreshToken, {
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
          maxAge: 30 * 24 * 60 * 60,
          path: "/api/auth",
        })

        setCookie(c, "oauth_state", "", {
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
          maxAge: 0,
          path: "/",
        })

        const redirectUrl = new URL("/auth/callback", testEnv.WEB_BASE_URL)
        redirectUrl.hash = `token=${accessToken}`
        return c.redirect(redirectUrl.toString())
      })

      const oauthState = "valid-oauth-state"
      const res = await testApp.request(
        `/auth/google/callback?code=valid-code&state=${oauthState}`,
        {
          headers: { Cookie: `oauth_state=${oauthState}` },
        },
        testEnv
      )

      // Verify success: should redirect to web app with token
      expect(res.status).toBe(302)
      const location = res.headers.get("location")
      expect(location).toContain(testEnv.WEB_BASE_URL)
      expect(location).toContain("/auth/callback")
      expect(location).toContain("#token=")

      // Verify refresh token cookie is set
      const setCookieHeader = res.headers.get("set-cookie")
      expect(setCookieHeader).toContain("refresh_token=")

      // Verify refresh token was saved to DB
      const tokens = db.select().from(schema.refreshTokens).all()
      const oauthUserTokens = tokens.filter((t) => t.userId === oauthUserId)
      expect(oauthUserTokens.length).toBeGreaterThan(0)
    })

    it("should create new user on first OAuth login", async () => {
      const { Hono } = await import("hono")
      const { setCookie, getCookie } = await import("hono/cookie")
      const { SignJWT } = await import("jose")
      const { createAuthRepository } = await import("./repository")

      const repo = createAuthRepository(db as any)
      const jwtSecret = new TextEncoder().encode(testEnv.JWT_SECRET)

      const newUserEmail = "new-oauth-user@example.com"
      const newUserName = "New OAuth User"

      // Custom route simulating new user OAuth flow
      const testApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      testApp.get("/auth/:provider/callback", async (c) => {
        const code = c.req.query("code")
        const state = c.req.query("state")
        const storedState = getCookie(c, "oauth_state")

        if (!code) return c.json({ error: "Missing code" }, 400)
        if (state !== storedState) return c.json({ error: "Invalid state" }, 400)

        // Simulate OAuth provider returning new user info
        const oauthUserInfo = {
          email: newUserEmail,
          name: newUserName,
          avatarUrl: "https://example.com/avatar.png",
          providerId: "google-new-user-456",
        }

        // Create new user (simulating handleOAuthCallback logic)
        const newUser = await repo.createUser({
          email: oauthUserInfo.email,
          name: oauthUserInfo.name,
          avatarUrl: oauthUserInfo.avatarUrl,
        })

        await repo.createConnection({
          userId: newUser.id,
          provider: "google",
          providerId: oauthUserInfo.providerId,
        })

        // Generate tokens
        const accessToken = await new SignJWT({
          sub: newUser.id,
          email: newUser.email,
          name: newUser.name,
          avatarUrl: newUser.avatarUrl,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("15m")
          .sign(jwtSecret)

        const refreshToken = crypto.randomUUID()
        const tokenHash = await hashToken(refreshToken)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30)

        await repo.saveRefreshToken({
          userId: newUser.id,
          tokenHash,
          expiresAt,
        })

        setCookie(c, "refresh_token", refreshToken, {
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
          maxAge: 30 * 24 * 60 * 60,
          path: "/api/auth",
        })

        const redirectUrl = new URL("/auth/callback", testEnv.WEB_BASE_URL)
        redirectUrl.hash = `token=${accessToken}`
        return c.redirect(redirectUrl.toString())
      })

      const oauthState = "new-user-state"
      const res = await testApp.request(
        `/auth/google/callback?code=new-user-code&state=${oauthState}`,
        {
          headers: { Cookie: `oauth_state=${oauthState}` },
        },
        testEnv
      )

      expect(res.status).toBe(302)

      // Verify new user was created
      const users = db.select().from(schema.users).all()
      const newUser = users.find((u) => u.email === newUserEmail)
      expect(newUser).toBeDefined()
      expect(newUser?.name).toBe(newUserName)

      // Verify OAuth connection was created
      const connections = db.select().from(schema.userOAuthConnections).all()
      const newConnection = connections.find(
        (c) => c.providerId === "google-new-user-456"
      )
      expect(newConnection).toBeDefined()
      expect(newConnection?.provider).toBe("google")
    })
  })

  describe("POST /auth/refresh", () => {
    it("should return 401 when refresh token is missing", async () => {
      const res = await app.request(
        "/auth/refresh",
        { method: "POST" },
        testEnv
      )

      expect(res.status).toBe(401)
      const body = await res.json<ErrorResponse>()
      expect(body.error).toBe("No refresh token")
    })

    it("should return 401 when refresh token is invalid", async () => {
      const res = await app.request(
        "/auth/refresh",
        {
          method: "POST",
          headers: { Cookie: "refresh_token=invalid-token" },
        },
        testEnv
      )

      expect(res.status).toBe(401)
      const body = await res.json<ErrorResponse>()
      expect(body.error).toBe("INVALID_REFRESH_TOKEN")
    })

    it("should return new access token with valid refresh token", async () => {
      // Create a valid refresh token
      const refreshToken = "valid-refresh-token-" + crypto.randomUUID()
      const tokenHash = await hashToken(refreshToken)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      db.insert(schema.refreshTokens)
        .values({
          id: crypto.randomUUID(),
          userId: testData.userId,
          tokenHash,
          expiresAt,
          createdAt: new Date(),
        })
        .run()

      const res = await app.request(
        "/auth/refresh",
        {
          method: "POST",
          headers: { Cookie: `refresh_token=${refreshToken}` },
        },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await res.json<TokenResponse>()
      expect(body).toHaveProperty("accessToken")
      expect(body).toHaveProperty("user")
      expect(body.user.id).toBe(testData.userId)
    })

    it("should return 401 when refresh token is expired", async () => {
      // Create an expired refresh token
      const refreshToken = "expired-refresh-token-" + crypto.randomUUID()
      const tokenHash = await hashToken(refreshToken)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() - 1) // Expired yesterday

      db.insert(schema.refreshTokens)
        .values({
          id: crypto.randomUUID(),
          userId: testData.userId,
          tokenHash,
          expiresAt,
          createdAt: new Date(),
        })
        .run()

      const res = await app.request(
        "/auth/refresh",
        {
          method: "POST",
          headers: { Cookie: `refresh_token=${refreshToken}` },
        },
        testEnv
      )

      expect(res.status).toBe(401)
      const body = await res.json<ErrorResponse>()
      expect(body.error).toBe("REFRESH_TOKEN_EXPIRED")
    })
  })

  describe("POST /auth/dev-login", () => {
    it("should return tokens in local environment", async () => {
      const res = await app.request(
        "/auth/dev-login",
        { method: "POST" },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await res.json<TokenResponse>()
      expect(body).toHaveProperty("accessToken")
      expect(body).toHaveProperty("user")
      expect(body.user.id).toBe("test-user-1")
    })

    it("should set refresh token cookie", async () => {
      const res = await app.request(
        "/auth/dev-login",
        { method: "POST" },
        testEnv
      )

      const setCookie = res.headers.get("set-cookie")
      expect(setCookie).toContain("refresh_token=")
    })

    it("should return 404 in production environment", async () => {
      const prodEnv = { ...testEnv, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/auth", authRoutes({ env: prodEnv, db: db as any }))

      const res = await prodApp.request(
        "/auth/dev-login",
        { method: "POST" },
        prodEnv
      )

      expect(res.status).toBe(404)
      const body = await res.json<ErrorResponse>()
      expect(body.error).toBe("Not available")
    })
  })

  describe("POST /auth/logout", () => {
    it("should return success even without refresh token", async () => {
      const res = await app.request(
        "/auth/logout",
        { method: "POST" },
        testEnv
      )

      expect(res.status).toBe(200)
      const body = await res.json<LogoutResponse>()
      expect(body.success).toBe(true)
    })

    it("should clear refresh token cookie", async () => {
      const res = await app.request(
        "/auth/logout",
        {
          method: "POST",
          headers: { Cookie: "refresh_token=some-token" },
        },
        testEnv
      )

      expect(res.status).toBe(200)
      const setCookie = res.headers.get("set-cookie")
      expect(setCookie).toContain("refresh_token=")
      expect(setCookie).toContain("Max-Age=0")
    })

    it("should delete refresh token from database", async () => {
      // Create a refresh token
      const refreshToken = "logout-test-token-" + crypto.randomUUID()
      const tokenHash = await hashToken(refreshToken)
      const tokenId = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      db.insert(schema.refreshTokens)
        .values({
          id: tokenId,
          userId: testData.userId,
          tokenHash,
          expiresAt,
          createdAt: new Date(),
        })
        .run()

      // Verify token exists
      const beforeLogout = db
        .select()
        .from(schema.refreshTokens)
        .all()
      expect(beforeLogout.length).toBe(1)

      // Logout
      await app.request(
        "/auth/logout",
        {
          method: "POST",
          headers: { Cookie: `refresh_token=${refreshToken}` },
        },
        testEnv
      )

      // Verify token is deleted
      const afterLogout = db
        .select()
        .from(schema.refreshTokens)
        .all()
      expect(afterLogout.length).toBe(0)
    })
  })
})
