import type { Context } from "hono"
import { streamSSE } from "hono/streaming"
import type { StreamChunk } from "./types"

export const streamToSSE = (
  c: Context,
  stream: AsyncIterable<StreamChunk>
): Response => {
  return streamSSE(c, async (sseStream) => {
    try {
      for await (const chunk of stream) {
        await sseStream.writeSSE({
          data: JSON.stringify(chunk),
        })
        if (chunk.type === "done" || chunk.type === "error") {
          break
        }
      }
    } catch (error) {
      await sseStream.writeSSE({
        data: JSON.stringify({ type: "error", error: String(error) }),
      })
    }
  })
}
