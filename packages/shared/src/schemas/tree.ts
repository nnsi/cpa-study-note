import { z } from "zod"
import { difficultySchema } from "./topic"

// Topic node in tree
export const topicNodeSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1, "名前は必須です").max(200, "名前は200文字以内で入力してください"),
  description: z.string().max(2000).nullable().optional(),
  difficulty: difficultySchema.nullable().optional(),
  topicType: z.string().max(50).nullable().optional(),
  aiSystemPrompt: z.string().max(5000).nullable().optional(),
  displayOrder: z.number().int().min(0),
})

export type TopicNode = z.infer<typeof topicNodeSchema>

// Subcategory (depth=2 category) node in tree
export const subcategoryNodeSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1, "名前は必須です").max(200, "名前は200文字以内で入力してください"),
  displayOrder: z.number().int().min(0),
  topics: z.array(topicNodeSchema),
})

export type SubcategoryNode = z.infer<typeof subcategoryNodeSchema>

// Category (depth=1 category) node in tree
export const categoryNodeSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1, "名前は必須です").max(200, "名前は200文字以内で入力してください"),
  displayOrder: z.number().int().min(0),
  subcategories: z.array(subcategoryNodeSchema),
})

export type CategoryNode = z.infer<typeof categoryNodeSchema>

// Tree update request schema
export const updateTreeRequestSchema = z.object({
  categories: z.array(categoryNodeSchema),
})

export type UpdateTreeRequest = z.infer<typeof updateTreeRequestSchema>

// Tree response schema (includes IDs for all nodes)
export const topicNodeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  difficulty: difficultySchema.nullable(),
  topicType: z.string().nullable(),
  aiSystemPrompt: z.string().nullable(),
  displayOrder: z.number(),
})

export type TopicNodeResponse = z.infer<typeof topicNodeResponseSchema>

export const subcategoryNodeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayOrder: z.number(),
  topics: z.array(topicNodeResponseSchema),
})

export type SubcategoryNodeResponse = z.infer<typeof subcategoryNodeResponseSchema>

export const categoryNodeResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayOrder: z.number(),
  subcategories: z.array(subcategoryNodeResponseSchema),
})

export type CategoryNodeResponse = z.infer<typeof categoryNodeResponseSchema>

export const treeResponseSchema = z.object({
  categories: z.array(categoryNodeResponseSchema),
})

export type TreeResponse = z.infer<typeof treeResponseSchema>

// CSV import request schema
export const csvImportRequestSchema = z.object({
  csvContent: z.string().min(1, "CSVデータは必須です"),
})

export type CSVImportRequest = z.infer<typeof csvImportRequestSchema>

// CSV import response schema
export const csvImportResponseSchema = z.object({
  success: z.boolean(),
  imported: z.object({
    categories: z.number(),
    subcategories: z.number(),
    topics: z.number(),
  }),
  errors: z.array(
    z.object({
      line: z.number(),
      message: z.string(),
    })
  ),
})

export type CSVImportResponse = z.infer<typeof csvImportResponseSchema>
