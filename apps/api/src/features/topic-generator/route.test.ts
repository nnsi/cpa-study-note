import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import type { Env, Variables } from "@/shared/types/env"
import { setupTestContext, createAuthHeaders, type TestContext } from "@/test/helpers"
import { loggerMiddleware } from "../../shared/middleware/logger"
import { topicGeneratorRoutes } from "./route"
import type { TestDatabase } from "@/test/mocks/db"

// AIアダプタをモック
vi.mock("../../shared/lib/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../shared/lib/ai")>()
  const { createMockAIAdapter } = await import("../../test/mocks/ai")

  const mockAdapter = createMockAIAdapter({
    streamChunks: [
      "棚卸資産に関する論点を提案します。\n\n",
      '```json\n{"categories":[{"name":"棚卸資産","topics":[{"name":"定義","description":"棚卸資産の定義"}]}]}\n```',
    ],
  })

  return {
    ...original,
    createAIAdapter: () => mockAdapter,
  }
})

// SSEレスポンスをパース
const parseSSEResponse = async (
  response: Response
): Promise<Array<{ type: string; content?: string; error?: string }>> => {
  const text = await response.text()
  const lines = text.split("\n")
  const chunks: Array<{ type: string; content?: string; error?: string }> = []

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        chunks.push(JSON.parse(line.slice(6)))
      } catch {
        // skip
      }
    }
  }
  return chunks
}

describe("topic-generator route", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    ctx = setupTestContext()
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
      .use("*", loggerMiddleware())
      .route(
      "/api/topic-generator",
      topicGeneratorRoutes({
        env: ctx.env,
        db: ctx.db as unknown as Parameters<typeof topicGeneratorRoutes>[0]["db"],
      })
    )
  })

  describe("POST /api/topic-generator/subjects/:subjectId/suggest", () => {
    it("正常なリクエストでSSEストリームを返す", async () => {
      const res = await app.request(
        `/api/topic-generator/subjects/${ctx.testData.subjectId}/suggest`,
        {
          method: "POST",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ prompt: "棚卸資産について提案して" }),
        },
        ctx.env
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/event-stream")

      const events = await parseSSEResponse(res)
      const textEvents = events.filter((e) => e.type === "text")
      const doneEvent = events.find((e) => e.type === "done")

      expect(textEvents.length).toBeGreaterThan(0)
      expect(doneEvent).toBeDefined()
    })

    it("存在しない科目IDの場合はSSEエラーイベントを返す", async () => {
      const res = await app.request(
        "/api/topic-generator/subjects/nonexistent-subject/suggest",
        {
          method: "POST",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ prompt: "テスト" }),
        },
        ctx.env
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/event-stream")

      const events = await parseSSEResponse(res)
      const errorEvent = events.find((e) => e.type === "error")
      expect(errorEvent).toBeDefined()
      expect(errorEvent?.error).toBe("科目が見つかりません")
    })

    it("promptが空の場合は400を返す", async () => {
      const res = await app.request(
        `/api/topic-generator/subjects/${ctx.testData.subjectId}/suggest`,
        {
          method: "POST",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({ prompt: "" }),
        },
        ctx.env
      )

      expect(res.status).toBe(400)
    })

    it("promptがない場合は400を返す", async () => {
      const res = await app.request(
        `/api/topic-generator/subjects/${ctx.testData.subjectId}/suggest`,
        {
          method: "POST",
          headers: createAuthHeaders(ctx.testData.userId),
          body: JSON.stringify({}),
        },
        ctx.env
      )

      expect(res.status).toBe(400)
    })

    it("認証なしの場合は401を返す", async () => {
      const res = await app.request(
        `/api/topic-generator/subjects/${ctx.testData.subjectId}/suggest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "テスト" }),
        },
        { ...ctx.env, ENVIRONMENT: "production" } as Env
      )

      expect(res.status).toBe(401)
    })
  })
})
