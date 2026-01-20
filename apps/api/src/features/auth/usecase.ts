import { ok, err, type Result } from "@/shared/lib/result"
import type { User, AuthError, OAuthUserInfo } from "./domain"
import type { AuthRepository } from "./repository"
import type { createProviders } from "./providers"

type AuthDeps = {
  repo: AuthRepository
  providers: ReturnType<typeof createProviders>
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
    oauthUser = await provider.getUserInfo(tokens.access_token)
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

  // 新規ユーザー作成
  const newUser = await deps.repo.createUser({
    email: oauthUser.email,
    name: oauthUser.name,
    avatarUrl: oauthUser.avatarUrl,
  })

  await deps.repo.createConnection({
    userId: newUser.id,
    provider: providerName,
    providerId: oauthUser.providerId,
  })

  return ok({ user: newUser, isNewUser: true })
}
