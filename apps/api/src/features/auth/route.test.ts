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

      const body = await res.json()
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

      const body = await res.json()
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

      const body = await res.json()
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

      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
      expect(body.error).toBe("Invalid state")
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
      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
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
      const body = await res.json()
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
