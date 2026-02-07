import { z } from "zod"

export const suggestTopicsRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
})

export type SuggestTopicsRequest = z.infer<typeof suggestTopicsRequestSchema>

export const topicSuggestionSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      topics: z.array(
        z.object({
          name: z.string(),
          description: z.string().nullable().default(null),
        })
      ),
    })
  ),
})

export type TopicSuggestions = z.infer<typeof topicSuggestionSchema>

export const topicGeneratorChunkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({ type: z.literal("error"), error: z.string() }),
  z.object({ type: z.literal("done") }),
])

export type TopicGeneratorChunk = z.infer<typeof topicGeneratorChunkSchema>
