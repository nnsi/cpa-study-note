import { ok, err, type Result } from "@/shared/lib/result"
import type { User, AuthError, OAuthUserInfo } from "./domain"
import type { AuthRepository } from "./repository"
import type { createProviders } from "./providers"
import type { User as EnvUser } from "@/shared/types/env"
import type { Db } from "@cpa-study/db"
import { createSampleDataForNewUser } from "./sample-data"

type AuthDeps = {
  repo: AuthRepository
  providers: ReturnType<typeof createProviders>
  db: Db
}

type RefreshDeps = {
  repo: AuthRepository
}

export const handleOAuthCallback = async (
  deps: AuthDeps,
  providerName: string,
  code: string
): Promise<Result<{ user: User; isNewUser: boolean }, AuthError>> => {
  const provider = deps.providers.get(providerName)
  if (!provider) return err("PROVIDER_NOT_FOUND")

  let tokens
  try {
    tokens = await provider.exchangeCode(code)
  } catch {
    return err("TOKEN_EXCHANGE_FAILED")
  }

  if (!tokens.access_token) return err("TOKEN_EXCHANGE_FAILED")

  let oauthUser: OAuthUserInfo
  try {
    oauthUser = await provider.getUserInfo(tokens)
  } catch {
    return err("USER_INFO_FAILED")
  }

  // 既存接続を確認
  const existingConnection = await deps.repo.findConnectionByProviderAndId(
    providerName,
    oauthUser.providerId
  )

  if (existingConnection) {
    const user = await deps.repo.findUserById(existingConnection.userId)
    if (!user) return err("DB_ERROR")
    return ok({ user, isNewUser: false })
  }

  // 同じメールの既存ユーザーに接続追加、または新規作成
  const existingUserByEmail = await deps.repo.findUserByEmail(oauthUser.email)

  if (existingUserByEmail) {
    await deps.repo.createConnection({
      userId: existingUserByEmail.id,
      provider: providerName,
      providerId: oauthUser.providerId,
    })
    return ok({ user: existingUserByEmail, isNewUser: false })
  }

  // 新規ユーザー作成（タイムゾーンはデフォルト Asia/Tokyo）
  const newUser = await deps.repo.createUser({
    email: oauthUser.email,
    name: oauthUser.name,
    avatarUrl: oauthUser.avatarUrl,
    timezone: "Asia/Tokyo",
  })

  await deps.repo.createConnection({
    userId: newUser.id,
    provider: providerName,
    providerId: oauthUser.providerId,
  })

  // Create sample data for new user
  try {
    const { studyDomainId } = await createSampleDataForNewUser(deps.db, newUser.id)
    // Update user's default study domain
    await deps.repo.updateUser(newUser.id, { defaultStudyDomainId: studyDomainId })
    newUser.defaultStudyDomainId = studyDomainId
  } catch (error) {
    // Log but don't fail - user can still use the app without sample data
    console.error("Failed to create sample data for new user:", error)
  }

  return ok({ user: newUser, isNewUser: true })
}

// Hash token for comparison
const hashToken = async (token: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const refreshAccessToken = async (
  deps: RefreshDeps,
  refreshToken: string,
  jwtSecret: Uint8Array,
  generateAccessToken: (user: EnvUser, secret: Uint8Array) => Promise<string>
): Promise<
  Result<{ accessToken: string; user: EnvUser }, AuthError>
> => {
  // Hash the provided token and look it up
  const tokenHash = await hashToken(refreshToken)
  const storedToken = await deps.repo.findRefreshTokenByHash(tokenHash)

  if (!storedToken) {
    return err("INVALID_REFRESH_TOKEN")
  }

  // Check expiration
  if (storedToken.expiresAt < new Date()) {
    // Delete expired token
    await deps.repo.deleteRefreshToken(storedToken.id)
    return err("REFRESH_TOKEN_EXPIRED")
  }

  // Get user
  const user = await deps.repo.findUserById(storedToken.userId)
  if (!user) {
    return err("DB_ERROR")
  }

  // Generate new access token
  const envUser: EnvUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    defaultStudyDomainId: user.defaultStudyDomainId,
  }
  const accessToken = await generateAccessToken(envUser, jwtSecret)

  return ok({ accessToken, user: envUser })
}
