import { z } from "zod"

// Request
export const quickChatSuggestRequestSchema = z.object({
  domainId: z.string().min(1),
  question: z.string().min(1).max(500),
})

export type QuickChatSuggestRequest = z.infer<typeof quickChatSuggestRequestSchema>

// Suggestion item
const quickChatSuggestionSchema = z.object({
  type: z.enum(["existing", "new"]),
  topicId: z.string().nullable(),
  topicName: z.string(),
  categoryName: z.string(),
  categoryId: z.string().nullable(),
  subjectId: z.string().nullable(),
  subjectName: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string(),
})

export type QuickChatSuggestion = z.infer<typeof quickChatSuggestionSchema>

// Response
export const quickChatSuggestResponseSchema = z.object({
  suggestions: z.array(quickChatSuggestionSchema),
})

export type QuickChatSuggestResponse = z.infer<typeof quickChatSuggestResponseSchema>
