import { z } from "zod"

/**
 * Markdownコードブロックを除去
 */
export const stripCodeBlock = (content: string): string => {
  // ```json や ``` で囲まれている場合は除去
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  return content.trim()
}

/**
 * LLM出力をパースしてスキーマで検証
 */
export const parseLLMJson = <T extends z.ZodTypeAny>(
  content: string,
  schema: T,
  fallback: z.infer<T>
): z.infer<T> => {
  try {
    const jsonStr = stripCodeBlock(content)
    const parsed = JSON.parse(jsonStr)
    const result = schema.safeParse(parsed)
    return result.success ? result.data : fallback
  } catch {
    return fallback
  }
}
