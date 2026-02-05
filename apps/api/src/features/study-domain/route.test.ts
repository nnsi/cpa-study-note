/// <reference types="@cloudflare/workers-types" />
/**
 * Study Domain Routes integration tests
 */
import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { z } from "zod"
import type { Env, Variables } from "../../shared/types/env"
import { studyDomainRoutes } from "./route"
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
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  emoji: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const studyDomainsListSchema = z.object({
  studyDomains: z.array(studyDomainSchema),
})

const studyDomainResponseSchema = z.object({
  studyDomain: studyDomainSchema,
})

describe("Study Domain Routes", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    ctx = setupTestContext()

    // Create routes
    const routes = studyDomainRoutes({ db: ctx.db as any })

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

  describe("GET /study-domains - List user's study domains", () => {
    it("should return user's study domains", async () => {
      // Create a domain for the user
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "user-domain",
          userId: ctx.testData.userId,
          name: "My Study Domain",
          description: "Test",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainsListSchema)
      expect(body.studyDomains).toBeDefined()
      expect(body.studyDomains.length).toBeGreaterThanOrEqual(1)

      const domain = body.studyDomains.find((d) => d.id === "user-domain")
      expect(domain).toBeDefined()
      expect(domain!.name).toBe("My Study Domain")
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
        .insert(schema.studyDomains)
        .values({
          id: "other-domain",
          userId: "other-user",
          name: "Other Domain",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainsListSchema)
      expect(body.studyDomains.some((d) => d.id === "other-domain")).toBe(false)
    })

    it("should not return soft-deleted domains", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "deleted-domain",
          userId: ctx.testData.userId,
          name: "Deleted Domain",
          createdAt: now,
          updatedAt: now,
          deletedAt: now,
        })
        .run()

      const res = await app.request("/study-domains", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainsListSchema)
      expect(body.studyDomains.some((d) => d.id === "deleted-domain")).toBe(false)
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/study-domains", studyDomainRoutes({ db: ctx.db as any }))

      const res = await prodApp.request("/study-domains", {}, prodEnv)

      expect(res.status).toBe(401)
    })
  })

  describe("GET /study-domains/:id - Get study domain by ID", () => {
    it("should return study domain when found and owned by user", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "my-domain",
          userId: ctx.testData.userId,
          name: "My Domain",
          description: "Test description",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/my-domain", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.id).toBe("my-domain")
      expect(body.studyDomain.name).toBe("My Domain")
    })

    it("should return 404 when domain does not exist", async () => {
      const res = await app.request("/study-domains/non-existent", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("学習領域が見つかりません")
    })

    it("should return 404 when domain belongs to other user", async () => {
      const now = new Date()
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
        .insert(schema.studyDomains)
        .values({
          id: "other-domain",
          userId: "other-user",
          name: "Other Domain",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/other-domain", {
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/study-domains", studyDomainRoutes({ db: ctx.db as any }))

      const res = await prodApp.request("/study-domains/any", {}, prodEnv)

      expect(res.status).toBe(401)
    })
  })

  describe("POST /study-domains - Create study domain", () => {
    it("should create study domain with valid data", async () => {
      const res = await app.request("/study-domains", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          name: "New Domain",
          description: "A new study domain",
          emoji: "📖",
          color: "blue",
        }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.name).toBe("New Domain")
      expect(body.studyDomain.description).toBe("A new study domain")
      expect(body.studyDomain.userId).toBe(ctx.testData.userId)
    })

    it("should create study domain with minimal fields", async () => {
      const res = await app.request("/study-domains", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          name: "Minimal Domain",
        }),
      })

      expect(res.status).toBe(201)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.name).toBe("Minimal Domain")
    })

    it("should return 400 when name is missing", async () => {
      const res = await app.request("/study-domains", {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/study-domains", studyDomainRoutes({ db: ctx.db as any }))

      const res = await prodApp.request(
        "/study-domains",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test",
          }),
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })

  describe("PATCH /study-domains/:id - Update study domain", () => {
    it("should update study domain name", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "update-domain",
          userId: ctx.testData.userId,
          name: "Old Name",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/update-domain", {
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
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "multi-update",
          userId: ctx.testData.userId,
          name: "Original",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/multi-update", {
        method: "PATCH",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          name: "New Name",
          description: "New Description",
          emoji: "🎓",
        }),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, studyDomainResponseSchema)
      expect(body.studyDomain.name).toBe("New Name")
      expect(body.studyDomain.description).toBe("New Description")
      expect(body.studyDomain.emoji).toBe("🎓")
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
      expect(body.error.message).toBe("学習領域が見つかりません")
    })

    it("should return 404 when domain belongs to other user", async () => {
      const now = new Date()
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
        .insert(schema.studyDomains)
        .values({
          id: "other-domain",
          userId: "other-user",
          name: "Other Domain",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/other-domain", {
        method: "PATCH",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({
          name: "Hijacked",
        }),
      })

      expect(res.status).toBe(404)
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/study-domains", studyDomainRoutes({ db: ctx.db as any }))

      const res = await prodApp.request(
        "/study-domains/any",
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
    it("should soft-delete study domain when no subjects exist", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "to-delete",
          userId: ctx.testData.userId,
          name: "To Delete",
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

      // Verify soft deletion (not visible anymore)
      const checkRes = await app.request("/study-domains/to-delete", {
        headers: createAuthHeaders(ctx.testData.userId),
      })
      expect(checkRes.status).toBe(404)
    })

    it("should return 404 when domain does not exist", async () => {
      const res = await app.request("/study-domains/non-existent", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
      const body = await parseJson(res, errorResponseSchema)
      expect(body.error.message).toBe("学習領域が見つかりません")
    })

    it("should cascade soft-delete subjects when domain is deleted", async () => {
      const now = new Date()
      ctx.db
        .insert(schema.studyDomains)
        .values({
          id: "has-subjects",
          userId: ctx.testData.userId,
          name: "Has Subjects",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      ctx.db
        .insert(schema.subjects)
        .values({
          id: "attached-subject",
          userId: ctx.testData.userId,
          studyDomainId: "has-subjects",
          name: "Attached Subject",
          displayOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/has-subjects", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(200)
      const body = await parseJson(res, successResponseSchema)
      expect(body.success).toBe(true)

      // Subject should also be soft-deleted
      const subjectRes = await app.request("/study-domains/has-subjects", {
        headers: createAuthHeaders(ctx.testData.userId),
      })
      expect(subjectRes.status).toBe(404)
    })

    it("should return 404 when domain belongs to other user", async () => {
      const now = new Date()
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
        .insert(schema.studyDomains)
        .values({
          id: "other-domain",
          userId: "other-user",
          name: "Other Domain",
          createdAt: now,
          updatedAt: now,
        })
        .run()

      const res = await app.request("/study-domains/other-domain", {
        method: "DELETE",
        headers: createAuthHeaders(ctx.testData.userId),
      })

      expect(res.status).toBe(404)
    })

    it("should require authentication", async () => {
      const prodEnv = { ...ctx.env, ENVIRONMENT: "production" as const }
      const prodApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      prodApp.route("/study-domains", studyDomainRoutes({ db: ctx.db as any }))

      const res = await prodApp.request(
        "/study-domains/any",
        {
          method: "DELETE",
        },
        prodEnv
      )

      expect(res.status).toBe(401)
    })
  })
})
