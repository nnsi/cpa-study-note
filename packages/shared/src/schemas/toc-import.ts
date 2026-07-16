import { z } from "zod"

export const tocSuggestRequestSchema = z.object({
  imageIds: z.array(z.string().min(1)).min(1).max(5),
})

export type TocSuggestRequest = z.infer<typeof tocSuggestRequestSchema>

export const tocSuggestionSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string().min(1).max(200),
      subcategories: z.array(
        z.object({
          name: z.string().min(1).max(200),
          topics: z.array(
            z.object({
              name: z.string().min(1).max(200),
            })
          ),
        })
      ),
    })
  ),
})

export type TocSuggestion = z.infer<typeof tocSuggestionSchema>
