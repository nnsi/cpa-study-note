import { describe, expect, it } from "vitest"
import { z } from "zod"
import { parseSSEStream } from "./sse"

const chunkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({ type: z.literal("done") }),
])

describe("parseSSEStream", () => {
  it("CRLFと複数のネットワークチャンクを処理する", async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"text","con'))
        controller.enqueue(encoder.encode('tent":"回答"}\r\n\r\ndata: {"type":"done"}\r\n\r\n'))
        controller.close()
      },
    })

    const chunks = []
    for await (const chunk of parseSSEStream(new Response(body), chunkSchema, "失敗")) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual([{ type: "text", content: "回答" }, { type: "done" }])
  })

  it("末尾の空行がない最終イベントも失わない", async () => {
    const response = new Response('data: {"type":"text","content":"末尾"}')
    const chunks = []
    for await (const chunk of parseSSEStream(response, chunkSchema, "失敗")) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual([{ type: "text", content: "末尾" }])
  })
})
