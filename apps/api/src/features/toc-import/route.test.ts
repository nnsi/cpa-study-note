import { beforeEach, describe, expect, it, vi } from "vitest"
import { topicGeneratorChunkSchema, type TopicGeneratorChunk } from "@cpa-study/shared/schemas"
import { Hono } from "hono"
import type { Env, Variables } from "@/shared/types/env"
import {
  createAuthHeaders,
  createImageTestData,
  setupTestContext,
  type TestContext,
} from "@/test/helpers"
import { loggerMiddleware } from "@/shared/middleware/logger"
import { tocImportRoutes } from "./route"

vi.mock("../../shared/lib/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../shared/lib/ai")>()
  const { createMockAIAdapter } = await import("../../test/mocks/ai")

  return {
    ...original,
    createAIAdapter: () =>
      createMockAIAdapter({
        streamChunks: ['```json\n{"categories":[]}\n```'],
      }),
  }
})

const parseSSEResponse = async (response: Response): Promise<TopicGeneratorChunk[]> => {
  const events: TopicGeneratorChunk[] = []
  for (const line of (await response.text()).split("\n")) {
    if (!line.startsWith("data: ")) continue

    let json: unknown
    try {
      json = JSON.parse(line.slice(6))
    } catch {
      continue
    }
    const parsed = topicGeneratorChunkSchema.safeParse(json)
    if (parsed.success) events.push(parsed.data)
  }
  return events
}

describe("toc-import route", () => {
  let ctx: TestContext
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    ctx = setupTestContext()
    app = new Hono<{ Bindings: Env; Variables: Variables }>().use("*", loggerMiddleware()).route(
      "/api/toc-import",
      tocImportRoutes({
        env: ctx.env,
        db: ctx.db as unknown as Parameters<typeof tocImportRoutes>[0]["db"],
      })
    )
  })

  it("認証なしの場合は401を返す", async () => {
    const response = await app.request(
      `/api/toc-import/subjects/${ctx.testData.subjectId}/suggest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: ["image-1"] }),
      },
      { ...ctx.env, ENVIRONMENT: "production" }
    )

    expect(response.status).toBe(401)
  })

  it("imageIdsが空の場合は400を返す", async () => {
    const response = await app.request(
      `/api/toc-import/subjects/${ctx.testData.subjectId}/suggest`,
      {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ imageIds: [] }),
      },
      ctx.env
    )

    expect(response.status).toBe(400)
  })

  it("正常時はSSE content-typeとtext→doneイベントを返す", async () => {
    const { imageId } = createImageTestData(ctx.db, ctx.testData.userId)
    await ctx.r2.put(`images/${imageId}/test.png`, new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)

    const response = await app.request(
      `/api/toc-import/subjects/${ctx.testData.subjectId}/suggest`,
      {
        method: "POST",
        headers: createAuthHeaders(ctx.testData.userId),
        body: JSON.stringify({ imageIds: [imageId] }),
      },
      ctx.env
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    expect(await parseSSEResponse(response)).toEqual([
      { type: "text", content: '```json\n{"categories":[]}\n```' },
      { type: "done" },
    ])
  })
})
