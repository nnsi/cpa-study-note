import { z } from "zod"

export const aiProviderSchema = z.enum(["mock", "vercel-ai"])
export type AIProvider = z.infer<typeof aiProviderSchema>

export const environmentSchema = z.enum(["local", "staging", "production"])
export type Environment = z.infer<typeof environmentSchema>

/**
 * 環境変数のバリデーションスキーマ（文字列系のみ）
 * D1/R2/DurableObjectはCloudflare側で注入されるためバリデーション不要
 */
export const envVarsSchema = z.object({
  ENVIRONMENT: environmentSchema,
  AI_PROVIDER: aiProviderSchema,
  JWT_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  API_BASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),
  DEV_USER_ID: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
})

export type EnvVars = z.infer<typeof envVarsSchema>

/**
 * 環境変数をパースしてバリデーション
 * 失敗時はエラーをthrow
 */
export const parseEnvVars = (env: Record<string, unknown>): EnvVars => {
  return envVarsSchema.parse(env)
}
