export type OAuthProvider = {
  name: string
  getAuthUrl: (state: string) => string
  exchangeCode: (code: string) => Promise<OAuthTokens>
  getUserInfo: (tokens: OAuthTokens) => Promise<OAuthUserInfo>
}

export type OAuthTokens = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  id_token?: string // OIDC ID Token for secure user info extraction
}

export type OAuthUserInfo = {
  providerId: string
  email: string
  name: string
  avatarUrl: string | null
}

export type User = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  timezone: string
  createdAt: Date
  updatedAt: Date
}

export type UserOAuthConnection = {
  id: string
  userId: string
  provider: string
  providerId: string
  createdAt: Date
}

export type RefreshToken = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  createdAt: Date
}

export type AuthError =
  | "PROVIDER_NOT_FOUND"
  | "TOKEN_EXCHANGE_FAILED"
  | "USER_INFO_FAILED"
  | "DB_ERROR"
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_TOKEN_EXPIRED"
