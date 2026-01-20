import { generateText, streamText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { AIAdapter, StreamChunk } from "../types"

export const createVercelAIAdapter = (apiKey: string): AIAdapter => {
  const openrouter = createOpenRouter({ apiKey })

  return {
    generateText: async (input) => {
      const result = await generateText({
        model: openrouter(input.model),
        messages: input.messages.map((m) => ({
          role: m.role,
          content: m.imageUrl
            ? [
                { type: "text" as const, text: m.content },
                { type: "image" as const, image: m.imageUrl },
              ]
            : m.content,
        })),
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
        const result = streamText({
          model: openrouter(input.model),
          messages: input.messages.map((m) => ({
            role: m.role,
            content: m.imageUrl
              ? [
                  { type: "text" as const, text: m.content },
                  { type: "image" as const, image: m.imageUrl },
                ]
              : m.content,
          })),
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
