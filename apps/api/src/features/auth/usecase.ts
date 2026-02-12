import { ok, err, type Result } from "@/shared/lib/result"
import type { User, OAuthUserInfo } from "./domain"
import type { AuthRepository } from "./repository"
import type { createProviders } from "./providers"
import type { User as EnvUser } from "@/shared/types/env"
import type { Db } from "@cpa-study/db"
import type { Logger } from "@/shared/lib/logger"
import { createSampleDataForNewUser } from "./sample-data"
import { notFound, unauthorized, internalError, type AppError } from "@/shared/lib/errors"

// OAuth認証用の全依存関係
type AuthDeps = {
  repo: AuthRepository
  providers: ReturnType<typeof createProviders>
  db: Db
  logger: Logger
}

// リポジトリのみを使用する操作用
type AuthRepoDeps = {
  repo: AuthRepository
  logger: Logger
}

export const handleOAuthCallback = async (
  deps: AuthDeps,
  providerName: string,
  code: string
): Promise<Result<{ user: User; isNewUser: boolean }, AppError>> => {
  const provider = deps.providers.get(providerName)
  if (!provider) return err(notFound("認証プロバイダーが見つかりません", { provider: providerName }))

  const { logger } = deps

  let tokens
  try {
    tokens = await provider.exchangeCode(code)
  } catch (error) {
    logger.error("Token exchange failed", {
      provider: providerName,
      error: error instanceof Error ? error.message : String(error),
    })
    return err(unauthorized("認証コードの交換に失敗しました"))
  }

  if (!tokens.access_token) {
    logger.error("No access token in response", { provider: providerName })
    return err(unauthorized("認証コードの交換に失敗しました"))
  }

  let oauthUser: OAuthUserInfo
  try {
    oauthUser = await provider.getUserInfo(tokens)
  } catch (error) {
    logger.error("Failed to get user info", {
      provider: providerName,
      error: error instanceof Error ? error.message : String(error),
    })
    return err(unauthorized("ユーザー情報の取得に失敗しました"))
  }

  // 既存接続を確認
  const existingConnection = await deps.repo.findConnectionByProviderAndId(
    providerName,
    oauthUser.providerId
  )

  if (existingConnection) {
    const user = await deps.repo.findUserById(existingConnection.userId)
    if (!user) return err(internalError("データベースエラーが発生しました"))
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
    logger.warn("Failed to create sample data for new user", {
      userId: newUser.id,
      error: error instanceof Error ? error.message : String(error),
    })
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

type DevLoginInput = {
  userId: string
  email: string
  name: string
  avatarUrl: string | null
  timezone: string
}

type SaveRefreshTokenInput = {
  userId: string
  tokenHash: string
  expiresAt: Date
}

/**
 * Get or create a dev user for local development
 */
export const getOrCreateDevUser = async (
  deps: AuthRepoDeps,
  input: DevLoginInput
): Promise<Result<User, AppError>> => {
  let user = await deps.repo.findUserById(input.userId)
  if (!user) {
    user = await deps.repo.createUserWithId(input.userId, {
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      timezone: input.timezone,
    })
  }

  if (!user) {
    return err(internalError("データベースエラーが発生しました"))
  }

  return ok(user)
}

/**
 * Save a refresh token for a user
 */
export const saveRefreshToken = async (
  deps: AuthRepoDeps,
  input: SaveRefreshTokenInput
): Promise<Result<void, AppError>> => {
  await deps.repo.saveRefreshToken({
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
  })
  return ok(undefined)
}

/**
 * Logout by deleting the refresh token
 */
export const logout = async (
  deps: AuthRepoDeps,
  refreshTokenHash: string
): Promise<Result<void, AppError>> => {
  const storedToken = await deps.repo.findRefreshTokenByHash(refreshTokenHash)
  if (storedToken) {
    await deps.repo.deleteRefreshToken(storedToken.id)
  }
  return ok(undefined)
}

export const refreshAccessToken = async (
  deps: AuthRepoDeps,
  refreshToken: string,
  jwtSecret: Uint8Array,
  generateAccessToken: (user: EnvUser, secret: Uint8Array) => Promise<string>
): Promise<Result<{ accessToken: string; user: EnvUser }, AppError>> => {
  // Hash the provided token and look it up
  const tokenHash = await hashToken(refreshToken)
  const storedToken = await deps.repo.findRefreshTokenByHash(tokenHash)

  if (!storedToken) {
    return err(unauthorized("無効なリフレッシュトークンです"))
  }

  // Check expiration
  if (storedToken.expiresAt < new Date()) {
    // Delete expired token
    await deps.repo.deleteRefreshToken(storedToken.id)
    return err(unauthorized("リフレッシュトークンの有効期限が切れています"))
  }

  // Get user
  const user = await deps.repo.findUserById(storedToken.userId)
  if (!user) {
    return err(internalError("データベースエラーが発生しました"))
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
