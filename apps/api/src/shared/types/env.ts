import type { EnvVars } from "../lib/env"
import type { Logger } from "../lib/logger"
import type { Tracer } from "../lib/tracer"

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
  timezone: string
  defaultStudyDomainId: string | null
}

export type Variables = {
  user: User
  rateLimitApplied?: boolean
  logger: Logger
  tracer: Tracer
}
