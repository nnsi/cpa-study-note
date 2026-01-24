import type { EnvVars } from "../lib/env"

export type Env = EnvVars & {
  DB: D1Database
  R2: R2Bucket
  RATE_LIMITER: DurableObjectNamespace
}

export type User = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

export type Variables = {
  user: User
  rateLimitApplied?: boolean
}
