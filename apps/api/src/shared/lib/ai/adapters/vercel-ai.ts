import { generateText, streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { AIAdapter, StreamChunk } from "../types"

export const createVercelAIAdapter = (apiKey: string): AIAdapter => {
  const openrouter = createOpenRouter({ apiKey })

  // レイテンシ優先でプロバイダーを選択（TTFB短縮）
  const buildModel = (modelId: string) =>
    openrouter(modelId, {
      extraBody: {
        provider: { sort: "latency" },
      },
    })

  return {
    generateText: async (input) => {
      const messages = input.messages.map((m) => {
        if (m.imageUrl) {
          return {
            role: m.role as "user",
            content: [
              { type: "text" as const, text: m.content },
              { type: "image" as const, image: m.imageUrl },
            ],
          }
        }
        return { role: m.role, content: m.content }
      })
      const result = await generateText({
        model: buildModel(input.model),
        messages,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      })
      return {
        content: result.text,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
            }
          : undefined,
      }
    },

    streamText: async function* (input): AsyncIterable<StreamChunk> {
      try {
        const messages = input.messages.map((m) => {
          if (m.imageUrl) {
            return {
              role: m.role as "user",
              content: [
                { type: "text" as const, text: m.content },
                { type: "image" as const, image: m.imageUrl },
              ],
            }
          }
          return { role: m.role, content: m.content }
        })
        const result = streamText({
          model: buildModel(input.model),
          messages,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        })

        for await (const text of result.textStream) {
          yield { type: "text", content: text }
        }
        yield { type: "done" }
      } catch (error) {
        yield { type: "error", error: String(error) }
      }
    },
  }
}
