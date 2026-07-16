import type { z } from "zod"

type StreamTerminal = { type?: string }

/**
 * SSE の改行コード・分割位置に依存せず data イベントを読み取る。
 * 最後のイベントが空行で終わらないレスポンスも処理する。
 */
export async function* parseSSEStream<T extends StreamTerminal>(
  response: Response,
  schema: z.ZodType<T>,
  errorLabel: string
): AsyncGenerator<T> {
  if (!response.body) throw new Error(errorLabel)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const parseEvent = (event: string): T | null => {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
    if (!data) return null

    try {
      const parsed = schema.safeParse(JSON.parse(data))
      if (parsed.success) return parsed.data
      if (import.meta.env.DEV) console.warn(`${errorLabel}: 不正なSSEデータ`, parsed.error)
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`${errorLabel}: SSEのJSON解析失敗`, error)
    }
    return null
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        const finalChunk = parseEvent(buffer.replace(/\r\n/g, "\n"))
        if (finalChunk) yield finalChunk
        return
      }

      buffer += decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, "\n")
      const events = buffer.split("\n\n")
      buffer = events.pop() ?? ""

      for (const event of events) {
        const chunk = parseEvent(event)
        if (!chunk) continue
        yield chunk
        if (chunk.type === "done" || chunk.type === "error") return
      }
    }
  } finally {
    reader.releaseLock()
  }
}
