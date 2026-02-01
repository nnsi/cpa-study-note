import { describe, it, expect, beforeEach } from "vitest"
import { testClient } from "hono/testing"
import { Hono } from "hono"
import type { Env, Variables } from "@/shared/types/env"
import type { Db } from "@cpa-study/db"
import { createTestDatabase, type TestDatabase } from "@/test/mocks/db"
import {
  createTestEnv,
  createAuthHeaders,
  createTestUser,
  createTestStudyDomain,
  createTestSubject,
  createTestCategory,
  createTestTopic,
} from "@/test/helpers"
import { subjectRoutes } from "./route"
import { authMiddleware } from "@/shared/middleware/auth"
import { createMockSimpleTransactionRunner } from "@/shared/lib/transaction"

// Helper to create test app with proper typing
const createTestApp = (env: Env, db: Db) => {
  const txRunner = createMockSimpleTransactionRunner(db)
  return new Hono<{ Bindings: Env; Variables: Variables }>()
    .use("*", (c, next) => {
      c.env = env
      return next()
    })
    .route("/api", subjectRoutes({ env, db, txRunner }))
}

type TestApp = ReturnType<typeof createTestApp>

describe("Subject Routes", () => {
  let db: TestDatabase
  let env: Env
  let client: ReturnType<typeof testClient<TestApp>>

  beforeEach(() => {
    const result = createTestDatabase()
    db = result.db
    env = createTestEnv()

    const app = createTestApp(env, db)
    client = testClient(app)
  })

  describe("GET /api/study-domains/:domainId/subjects", () => {
    it("should return 401 without auth", async () => {
      const res = await client.api["study-domains"][":domainId"].subjects.$get({
        param: { domainId: "test-domain" },
      })

      expect(res.status).toBe(401)
    })

    it("should return subjects for user's study domain", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      createTestSubject(db, userId, domainId, { name: "Subject 1" })
      createTestSubject(db, userId, domainId, { name: "Subject 2" })

      const res = await client.api["study-domains"][":domainId"].subjects.$get(
        { param: { domainId } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      if (!("subjects" in json)) throw new Error("Expected subjects in response")
      expect(json.subjects).toHaveLength(2)
    })

    it("should return 404 for non-existent study domain", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId

      const res = await client.api["study-domains"][":domainId"].subjects.$get(
        { param: { domainId: "non-existent" } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 404 for other user's study domain", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      env.DEV_USER_ID = user2Id
      const { id: domainId } = createTestStudyDomain(db, user1Id)

      const res = await client.api["study-domains"][":domainId"].subjects.$get(
        { param: { domainId } },
        { headers: createAuthHeaders(user2Id) }
      )

      expect(res.status).toBe(404)
    })

    it("should not return soft-deleted subjects", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      createTestSubject(db, userId, domainId, { name: "Active" })
      createTestSubject(db, userId, domainId, { name: "Deleted", deletedAt: new Date() })

      const res = await client.api["study-domains"][":domainId"].subjects.$get(
        { param: { domainId } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      if (!("subjects" in json)) throw new Error("Expected subjects in response")
      expect(json.subjects).toHaveLength(1)
      expect(json.subjects[0].name).toBe("Active")
    })
  })

  describe("GET /api/subjects/:id", () => {
    it("should return 401 without auth", async () => {
      const res = await client.api.subjects[":id"].$get({
        param: { id: "test-id" },
      })

      expect(res.status).toBe(401)
    })

    it("should return subject by id", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { name: "My Subject" })

      const res = await client.api.subjects[":id"].$get(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      if (!("subject" in json)) throw new Error("Expected subject in response")
      expect(json.subject.name).toBe("My Subject")
    })

    it("should return 404 for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId

      const res = await client.api.subjects[":id"].$get(
        { param: { id: "non-existent" } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 404 for other user's subject", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      env.DEV_USER_ID = user2Id
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const res = await client.api.subjects[":id"].$get(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(user2Id) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 404 for soft-deleted subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { deletedAt: new Date() })

      const res = await client.api.subjects[":id"].$get(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(404)
    })
  })

  describe("POST /api/study-domains/:domainId/subjects", () => {
    it("should return 401 without auth", async () => {
      const res = await client.api["study-domains"][":domainId"].subjects.$post({
        param: { domainId: "test-domain" },
        json: { name: "New Subject" },
      })

      expect(res.status).toBe(401)
    })

    it("should create a new subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)

      const res = await client.api["study-domains"][":domainId"].subjects.$post(
        {
          param: { domainId },
          json: {
            name: "New Subject",
            description: "A description",
            emoji: "📚",
            color: "blue",
          },
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(201)
      const json = await res.json()
      if (!("subject" in json)) throw new Error("Expected subject in response")
      expect(json.subject.name).toBe("New Subject")
      expect(json.subject.description).toBe("A description")
      expect(json.subject.emoji).toBe("📚")
      expect(json.subject.color).toBe("blue")
    })

    it("should return 404 for non-existent study domain", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId

      const res = await client.api["study-domains"][":domainId"].subjects.$post(
        {
          param: { domainId: "non-existent" },
          json: { name: "New Subject" },
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 404 for other user's study domain", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      env.DEV_USER_ID = user2Id
      const { id: domainId } = createTestStudyDomain(db, user1Id)

      const res = await client.api["study-domains"][":domainId"].subjects.$post(
        {
          param: { domainId },
          json: { name: "Hijacked Subject" },
        },
        { headers: createAuthHeaders(user2Id) }
      )

      expect(res.status).toBe(404)
    })

    it("should validate request body", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)

      const res = await client.api["study-domains"][":domainId"].subjects.$post(
        {
          param: { domainId },
          json: { name: "" }, // Empty name
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(400)
    })
  })

  describe("PATCH /api/subjects/:id", () => {
    it("should return 401 without auth", async () => {
      const res = await client.api.subjects[":id"].$patch({
        param: { id: "test-id" },
        json: { name: "Updated" },
      })

      expect(res.status).toBe(401)
    })

    it("should update an existing subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, { name: "Original" })

      const res = await client.api.subjects[":id"].$patch(
        {
          param: { id: subjectId },
          json: { name: "Updated", description: "New Description" },
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      if (!("subject" in json)) throw new Error("Expected subject in response")
      expect(json.subject.name).toBe("Updated")
      expect(json.subject.description).toBe("New Description")
    })

    it("should return 404 for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId

      const res = await client.api.subjects[":id"].$patch(
        {
          param: { id: "non-existent" },
          json: { name: "Updated" },
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 404 for other user's subject", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      env.DEV_USER_ID = user2Id
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const res = await client.api.subjects[":id"].$patch(
        {
          param: { id: subjectId },
          json: { name: "Hijacked" },
        },
        { headers: createAuthHeaders(user2Id) }
      )

      expect(res.status).toBe(404)
    })

    it("should only update provided fields", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId, {
        name: "Original",
        emoji: "📚",
      })

      const res = await client.api.subjects[":id"].$patch(
        {
          param: { id: subjectId },
          json: { name: "Updated" },
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      if (!("subject" in json)) throw new Error("Expected subject in response")
      expect(json.subject.name).toBe("Updated")
      expect(json.subject.emoji).toBe("📚") // Unchanged
    })
  })

  describe("DELETE /api/subjects/:id", () => {
    it("should return 401 without auth", async () => {
      const res = await client.api.subjects[":id"].$delete({
        param: { id: "test-id" },
      })

      expect(res.status).toBe(401)
    })

    it("should soft-delete a subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const res = await client.api.subjects[":id"].$delete(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      if (!("success" in json)) throw new Error("Expected success in response")
      expect(json.success).toBe(true)

      // Verify it's soft-deleted (GET should return 404)
      const getRes = await client.api.subjects[":id"].$get(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(userId) }
      )
      expect(getRes.status).toBe(404)
    })

    it("should return 404 for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId

      const res = await client.api.subjects[":id"].$delete(
        { param: { id: "non-existent" } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 404 for other user's subject", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      env.DEV_USER_ID = user2Id
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const res = await client.api.subjects[":id"].$delete(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(user2Id) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 409 if subject has categories", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      createTestCategory(db, userId, subjectId, { name: "Category" })

      const res = await client.api.subjects[":id"].$delete(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(409)
      const json = await res.json()
      if (!("error" in json)) throw new Error("Expected error in response")
      expect(json.error).toContain("削除できません")
    })
  })

  describe("GET /api/subjects/:id/tree", () => {
    it("should return 401 without auth", async () => {
      const res = await client.api.subjects[":id"].tree.$get({
        param: { id: "test-id" },
      })

      expect(res.status).toBe(401)
    })

    it("should return tree for subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)
      const { id: catId } = createTestCategory(db, userId, subjectId, { name: "Category", depth: 1 })
      const { id: subcatId } = createTestCategory(db, userId, subjectId, {
        name: "Subcategory",
        depth: 2,
        parentId: catId,
      })
      createTestTopic(db, userId, subcatId, { name: "Topic" })

      const res = await client.api.subjects[":id"].tree.$get(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      if (!("tree" in json)) throw new Error("Expected tree in response")
      expect(json.tree.categories).toHaveLength(1)
      expect(json.tree.categories[0].name).toBe("Category")
      expect(json.tree.categories[0].subcategories[0].name).toBe("Subcategory")
      expect(json.tree.categories[0].subcategories[0].topics[0].name).toBe("Topic")
    })

    it("should return 404 for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId

      const res = await client.api.subjects[":id"].tree.$get(
        { param: { id: "non-existent" } },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 404 for other user's subject", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      env.DEV_USER_ID = user2Id
      const { id: domainId } = createTestStudyDomain(db, user1Id)
      const { id: subjectId } = createTestSubject(db, user1Id, domainId)

      const res = await client.api.subjects[":id"].tree.$get(
        { param: { id: subjectId } },
        { headers: createAuthHeaders(user2Id) }
      )

      expect(res.status).toBe(404)
    })
  })

  describe("PUT /api/subjects/:id/tree", () => {
    it("should return 401 without auth", async () => {
      const res = await client.api.subjects[":id"].tree.$put({
        param: { id: "test-id" },
        json: { categories: [] },
      })

      expect(res.status).toBe(401)
    })

    it("should update tree and return updated version", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const res = await client.api.subjects[":id"].tree.$put(
        {
          param: { id: subjectId },
          json: {
            categories: [
              {
                id: null,
                name: "New Category",
                displayOrder: 0,
                subcategories: [
                  {
                    id: null,
                    name: "New Subcategory",
                    displayOrder: 0,
                    topics: [
                      {
                        id: null,
                        name: "New Topic",
                        displayOrder: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      if (!("tree" in json)) throw new Error("Expected tree in response")
      expect(json.tree.categories).toHaveLength(1)
      expect(json.tree.categories[0].name).toBe("New Category")
      expect(json.tree.categories[0].id).toBeDefined() // ID should be assigned
    })

    it("should return 404 for non-existent subject", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId

      const res = await client.api.subjects[":id"].tree.$put(
        {
          param: { id: "non-existent" },
          json: { categories: [] },
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(404)
    })

    it("should return 400 for invalid ID", async () => {
      const { id: user1Id } = createTestUser(db)
      const { id: user2Id } = createTestUser(db)
      env.DEV_USER_ID = user1Id
      const { id: domain1Id } = createTestStudyDomain(db, user1Id)
      const { id: domain2Id } = createTestStudyDomain(db, user2Id)
      const { id: subject1Id } = createTestSubject(db, user1Id, domain1Id)
      const { id: subject2Id } = createTestSubject(db, user2Id, domain2Id)
      const { id: cat2Id } = createTestCategory(db, user2Id, subject2Id, { name: "Other User Cat", depth: 1 })

      const res = await client.api.subjects[":id"].tree.$put(
        {
          param: { id: subject1Id },
          json: {
            categories: [
              {
                id: cat2Id, // Other user's category
                name: "Hijacked",
                displayOrder: 0,
                subcategories: [],
              },
            ],
          },
        },
        { headers: createAuthHeaders(user1Id) }
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      if (!("error" in json)) throw new Error("Expected error in response")
      expect(json.error).toContain("不正なID")
    })

    it("should validate request body", async () => {
      const { id: userId } = createTestUser(db)
      env.DEV_USER_ID = userId
      const { id: domainId } = createTestStudyDomain(db, userId)
      const { id: subjectId } = createTestSubject(db, userId, domainId)

      const res = await client.api.subjects[":id"].tree.$put(
        {
          param: { id: subjectId },
          json: {
            categories: [
              {
                id: null,
                name: "", // Empty name (invalid)
                displayOrder: 0,
                subcategories: [],
              },
            ],
          },
        },
        { headers: createAuthHeaders(userId) }
      )

      expect(res.status).toBe(400)
    })
  })

  // Note: Import business logic tests are covered in csv-import.test.ts
})
