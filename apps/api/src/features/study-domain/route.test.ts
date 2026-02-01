/// <reference types="@cloudflare/workers-types" />
/**
 * Study Domain Routes integration tests
 */
import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { studyDomainRoutes, userStudyDomainRoutes } from "./route"
import {
  setupTestContext,
  createAuthHeaders,
  parseJson,
  errorResponseSchema,
  successResponseSchema,
  type TestContext,
} from "../../test/helpers"
import * as schema from "@cpa-study/db/schema"

// Response schemas
const studyDomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  emoji: z.string().nullable(),
  color: z.string().nullable(),
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const studyDomainsListSchema = z.object({
  studyDomains: z.array(studyDomainSchema),
})

const studyDomainResponseSchema = z.object({
  studyDomain: studyDomainSchema,
})

const userStudyDomainSchema = z.object({
  id: z.string(),
  userId: z.string(),
  studyDomainId: z.string(),
  joinedAt: z.string(),
  studyDomain: studyDomainSchema,
})

const userStudyDomainsListSchema = z.object({
  userStudyDomains: z.array(userStudyDomainSchema),
})

const userStudyDomainResponseSchema = z.object({
  userStudyDomain: userStudyDomainSchema,
})

describe("Study Domain Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    ctx = setupTestContext()

    // Create routes
    const routes = studyDomainRoutes({ env: ctx.env, db: ctx.db as any })

    // Mount on main app with environment setup
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.route("/study-domains", routes)
  })

  describe("GET /study-domains - List public study domains", () => {
    it("should return all public study domains", async () => {
      const res = await app.request("/study-domains")

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainsListSchema)
      expect(body.studyDomains).toBeDefined()
      expect(body.studyDomains.length).toBeGreaterThanOrEqual(1)

      const cpaDomain = body.studyDomains.find((d) => d.id === "cpa")
      expect(cpaDomain).toBeDefined()
      expect(cpaDomain!.name).toBe("公認会計士試験")
    })

    it("should not return private domains", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "private-domain",
          name: "Private Domain",
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains")

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainsListSchema)
      expect(body.studyDomains.some((d) => d.id === "private-domain")).toBe(false)
    })

    it("should return empty array when no public domains exist", async () => {
      // Delete all subjects first (foreign key constraint), then domains
      ctx.db.delete(schema.subjects).run()
      ctx.db.delete(schema.studyDomains).run()

      const res = await app.request("/study-domains")

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainsListSchema)
      expect(body.studyDomains).toEqual([])
    })
  })

  describe("GET /study-domains/:id - Get study domain by ID", () => {
    it("should return study domain when found", async () => {
      const res = await app.request("/study-domains/cpa")

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.id).toBe("cpa")
      expect(body.studyDomain.name).toBe("公認会計士試験")
      expect(body.studyDomain.description).toBe("公認会計士試験の学習")
    })

    it("should return 404 when domain does not exist", async () => {
      const res = await app.request("/study-domains/non-existent")

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("学習領域が見つかりません")
    })

    it("should return private domain by ID (not filtered by isPublic)", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "private-get",
          name: "Private Get",
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/private-get")

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.isPublic).toBe(false)
    })
  })

  describe("POST /study-domains - Create study domain", () => {
    it("should create study domain with valid data", async () => {
      const res = await app.request("/study-domains", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          id: "new-domain",
          name: "New Domain",
          description: "A new study domain",
          emoji: "📖",
          color: "blue",
        }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.id).toBe("new-domain")
      expect(body.studyDomain.name).toBe("New Domain")
      expect(body.studyDomain.description).toBe("A new study domain")
    })

    it("should create study domain with minimal fields", async () => {
      const res = await app.request("/study-domains", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          id: "minimal",
          name: "Minimal Domain",
        }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.id).toBe("minimal")
      expect(body.studyDomain.isPublic).toBe(true) // default
    })

    it("should return 409 when ID already exists", async () => {
      const res = await app.request("/study-domains", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          id: "cpa", // Already exists
          name: "Duplicate",
        }),
      })

      expect(res.status).toBe(409)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("このIDの学習領域は既に存在します")
    })

    it("should return 400 for invalid ID format", async () => {
      const res = await app.request("/study-domains", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          id: "Invalid ID!", // Contains invalid characters
          name: "Test",
        }),
      })

      expect(res.status).toBe(400)
    })

    it("should return 400 when name is missing", async () => {
      const res = await app.request("/study-domains", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          id: "no-name",
        }),
      })

      expect(res.status).toBe(400)
    })

    it("should require authentication", async () => {
      // In production environment, this should return 401
      // In local/test environment with DEV_USER_ID set, it may pass
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/study-domains", studyDomainRoutes({ env: prodEnv, db: ctx.db as any }))

      const res = await prodApp.request(
        "/study-domains",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "test-auth",
            name: "Test Auth",
          }),
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })

  describe("PATCH /study-domains/:id - Update study domain", () => {
    it("should update study domain name", async () => {
      const res = await app.request("/study-domains/cpa", {
        method: "PATCH",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          name: "Updated Name",
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.name).toBe("Updated Name")
    })

    it("should update multiple fields", async () => {
      const res = await app.request("/study-domains/cpa", {
        method: "PATCH",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          name: "New Name",
          description: "New Description",
          emoji: "🎓",
          isPublic: false,
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.name).toBe("New Name")
      expect(body.studyDomain.description).toBe("New Description")
      expect(body.studyDomain.emoji).toBe("🎓")
      expect(body.studyDomain.isPublic).toBe(false)
    })

    it("should return 404 when domain does not exist", async () => {
      const res = await app.request("/study-domains/non-existent", {
        method: "PATCH",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          name: "New Name",
        }),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("学習領域が見つかりません")
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/study-domains", studyDomainRoutes({ env: prodEnv, db: ctx.db as any }))

      const res = await prodApp.request(
        "/study-domains/cpa",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New" }),
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })

  describe("DELETE /study-domains/:id - Delete study domain", () => {
    it("should delete study domain when no subjects exist", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "to-delete",
          name: "To Delete",
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/to-delete", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, successResponseSchema)
      expect(body.success).toBe(true)

      // Verify deletion
      const checkRes = await app.request("/study-domains/to-delete")
      expect(checkRes.status).toBe(404)
    })

    it("should return 404 when domain does not exist", async () => {
      const res = await app.request("/study-domains/non-existent", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("学習領域が見つかりません")
    })

    it("should return 409 when subjects are attached", async () => {
      // cpa domain has subjects attached
      const res = await app.request("/study-domains/cpa", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(409)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toContain("件の科目が紐づいています")
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/study-domains", studyDomainRoutes({ env: prodEnv, db: ctx.db as any }))

      const res = await prodApp.request(
        "/study-domains/cpa",
        {
          method: "DELETE",
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })
})

describe("User Study Domain Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    ctx = setupTestContext()

    // Create routes
    const routes = userStudyDomainRoutes({ env: ctx.env, db: ctx.db as any })

    // Mount on main app with environment setup
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, ctx.env)
      await next()
    })
    app.route("/me/study-domains", routes)
  })

  describe("GET /me/study-domains - List user's joined study domains", () => {
    it("should return empty array when user has no joined domains", async () => {
      const res = await app.request("/me/study-domains", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, userStudyDomainsListSchema)
      expect(body.userStudyDomains).toHaveLength(0)
    })

    it("should return user's joined domains", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.userStudyDomains)
        .values({
          id: "usd-test",
          userId: ctx.testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const res = await app.request("/me/study-domains", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, userStudyDomainsListSchema)
      expect(body.userStudyDomains).toHaveLength(1)
      expect(body.userStudyDomains[0].studyDomainId).toBe("cpa")
      expect(body.userStudyDomains[0].studyDomain.name).toBe("公認会計士試験")
    })

    it("should not return other user's domains", async () => {
      const now = new Date()
      // Create another user
      ctx.db
        .insert(schema.users)
        .values({
          id: "other-user",
          email: "other@example.com",
          name: "Other User",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      ctx.db
        .insert(schema.userStudyDomains)
        .values({
          id: "usd-other",
          userId: "other-user",
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const res = await app.request("/me/study-domains", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, userStudyDomainsListSchema)
      expect(body.userStudyDomains).toHaveLength(0)
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/me/study-domains", userStudyDomainRoutes({ env: prodEnv, db: ctx.db as any }))

      const res = await prodApp.request("/me/study-domains", {}, prodEnv)

      expect(res.status).toBe(401)
    })
  })

  describe("POST /me/study-domains/:id/join - Join study domain", () => {
    it("should join study domain successfully", async () => {
      const res = await app.request("/me/study-domains/cpa/join", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, userStudyDomainResponseSchema)
      expect(body.userStudyDomain.userId).toBe(ctx.testData.userId)
      expect(body.userStudyDomain.studyDomainId).toBe("cpa")
      expect(body.userStudyDomain.studyDomain.name).toBe("公認会計士試験")
    })

    it("should return 404 when domain does not exist", async () => {
      const res = await app.request("/me/study-domains/non-existent/join", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("学習領域が見つかりません")
    })

    it("should return 409 when already joined", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.userStudyDomains)
        .values({
          id: "usd-already",
          userId: ctx.testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const res = await app.request("/me/study-domains/cpa/join", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(409)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("既にこの学習領域に参加しています")
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/me/study-domains", userStudyDomainRoutes({ env: prodEnv, db: ctx.db as any }))

      const res = await prodApp.request(
        "/me/study-domains/cpa/join",
        {
          method: "POST",
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })

  describe("DELETE /me/study-domains/:id/leave - Leave study domain", () => {
    it("should leave study domain successfully", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.userStudyDomains)
        .values({
          id: "usd-leave",
          userId: ctx.testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      const res = await app.request("/me/study-domains/cpa/leave", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, successResponseSchema)
      expect(body.success).toBe(true)

      // Verify removal
      const listRes = await app.request("/me/study-domains", {
        headers: createAuthHeaders(ctx.testData.userId),
      })
      const listBody = await parseJson(listRes, userStudyDomainsListSchema)
      expect(listBody.userStudyDomains).toHaveLength(0)
    })

    it("should return 404 when domain does not exist", async () => {
      const res = await app.request("/me/study-domains/non-existent/leave", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("学習領域が見つかりません")
    })

    it("should return 400 when not joined", async () => {
      const res = await app.request("/me/study-domains/cpa/leave", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(400)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error).toBe("この学習領域には参加していません")
    })

    it("should preserve learning history when leaving", async () => {
      const now = new Date()

      // User joins domain and has learning progress
      ctx.db
        .insert(schema.userStudyDomains)
        .values({
          id: "usd-progress",
          userId: ctx.testData.userId,
          studyDomainId: "cpa",
          joinedAt: now,
        })
        .run()

      ctx.db
        .insert(schema.userTopicProgress)
        .values({
          id: "progress-preserve",
          userId: ctx.testData.userId,
          topicId: ctx.testData.topicId,
          understood: true,
          questionCount: 10,
          goodQuestionCount: 3,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Leave domain
      const res = await app.request("/me/study-domains/cpa/leave", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)

      // Verify progress is preserved
      const progressRecords = ctx.db.select().from(schema.userTopicProgress).all()
      const progress = progressRecords.find((p) => p.id === "progress-preserve")
      expect(progress).toBeDefined()
      expect(progress?.understood).toBe(true)
      expect(progress?.questionCount).toBe(10)
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/me/study-domains", userStudyDomainRoutes({ env: prodEnv, db: ctx.db as any }))

      const res = await prodApp.request(
        "/me/study-domains/cpa/leave",
        {
          method: "DELETE",
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })
})
