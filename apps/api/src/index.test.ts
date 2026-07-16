import { describe, expect, it } from "vitest"
import { setupTestContext } from "./test/helpers"
import { createApp } from "./index"

describe("API application middleware", () => {
  it("不正なOriginでも例外にせずレスポンスを返す", async () => {
    const context = setupTestContext()
    const app = createApp(context.env)
    const response = await app.request(
      "/api/health",
      { headers: { Origin: "not a valid URL" } },
      context.env
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok" })
  })

  it("すべてのAIエンドポイントに中程度のレート制限を適用する", async () => {
    const context = setupTestContext()
    const app = createApp(context.env)
    const paths = [
      "/api/chat/sessions/session-1/messages/stream",
      "/api/chat/topics/topic-1/messages/stream",
      "/api/chat/correct-speech",
      "/api/chat/messages/message-1/evaluate",
      "/api/images/image-1/ocr",
      "/api/exercises/analyze",
      "/api/notes",
      "/api/notes/note-1/refresh",
      "/api/topic-generator/subjects/subject-1/suggest",
      "/api/toc-import/subjects/subject-1/suggest",
      "/api/quick-chat/suggest",
      "/api/study-plans/plan-1/suggest",
    ]

    for (const path of paths) {
      const response = await app.request(
        path,
        {
          method: "POST",
          headers: { "CF-Connecting-IP": `test-${path}` },
        },
        context.env
      )
      expect(response.headers.get("X-RateLimit-Limit"), path).toBe("20")
    }
  })
})
