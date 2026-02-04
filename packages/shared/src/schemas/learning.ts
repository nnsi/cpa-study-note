import { z } from "zod"

// Re-export from topic.ts for backward compatibility
export { updateProgressRequestSchema, type UpdateProgressRequest } from "./topic"
export { userTopicProgressSchema, type UserTopicProgress } from "./topic"

// Recent topics query
export const recentTopicsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
})

export type RecentTopicsQuery = z.infer<typeof recentTopicsQuerySchema>
