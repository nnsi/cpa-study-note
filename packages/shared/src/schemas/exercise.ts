import { z } from "zod"

// Confidence level for topic suggestions
export const confidenceSchema = z.enum(["high", "medium", "low"])
export type Confidence = z.infer<typeof confidenceSchema>

// Suggested topic from AI
export const suggestedTopicSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  subjectName: z.string(),
  confidence: confidenceSchema,
  reason: z.string(),
})

export type SuggestedTopic = z.infer<typeof suggestedTopicSchema>

// Exercise entity
export const exerciseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  imageId: z.string(),
  topicId: z.string().nullable(),
  suggestedTopicIds: z.array(z.string()).nullable(),
  markedAsUnderstood: z.boolean(),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
})

export type Exercise = z.infer<typeof exerciseSchema>

// ========== Request Schemas ==========

// Analyze request - multipart/form-data で画像を受け取る
export const analyzeExerciseRequestSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
})

export type AnalyzeExerciseRequest = z.infer<typeof analyzeExerciseRequestSchema>

// Confirm request
export const confirmExerciseRequestSchema = z.object({
  topicId: z.string().min(1, "論点IDは必須です"),
  markAsUnderstood: z.boolean().default(false),
})

export type ConfirmExerciseRequest = z.infer<typeof confirmExerciseRequestSchema>

// ========== Response Schemas ==========

// Analyze response
export const analyzeExerciseResponseSchema = z.object({
  exerciseId: z.string(),
  imageId: z.string(),
  ocrText: z.string(),
  suggestedTopics: z.array(suggestedTopicSchema),
})

export type AnalyzeExerciseResponse = z.infer<typeof analyzeExerciseResponseSchema>

// Confirm response
export const confirmExerciseResponseSchema = z.object({
  exerciseId: z.string(),
  topicId: z.string(),
  topicChecked: z.boolean(),
  createdAt: z.string().datetime(),
})

export type ConfirmExerciseResponse = z.infer<typeof confirmExerciseResponseSchema>

// Exercise with image info for list display
export const exerciseWithImageSchema = z.object({
  exerciseId: z.string(),
  imageId: z.string(),
  ocrText: z.string().nullable(),
  createdAt: z.string().datetime(),
  markedAsUnderstood: z.boolean(),
})

export type ExerciseWithImage = z.infer<typeof exerciseWithImageSchema>

// Topic exercises response
export const topicExercisesResponseSchema = z.object({
  exercises: z.array(exerciseWithImageSchema),
})

export type TopicExercisesResponse = z.infer<typeof topicExercisesResponseSchema>
