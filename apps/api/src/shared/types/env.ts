export type Env = {
  DB: D1Database
  R2: R2Bucket
  ENVIRONMENT: "local" | "staging" | "production"
  DEV_USER_ID?: string
  JWT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  API_BASE_URL: string
  WEB_BASE_URL: string
  AI_PROVIDER: "mock" | "vercel-ai"
  OPENROUTER_API_KEY?: string
}

export type User = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

export type Variables = {
  user: User
}
