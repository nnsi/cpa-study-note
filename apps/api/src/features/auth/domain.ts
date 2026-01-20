export type OAuthProvider = {
  name: string
  getAuthUrl: (state: string) => string
  exchangeCode: (code: string) => Promise<OAuthTokens>
  getUserInfo: (accessToken: string) => Promise<OAuthUserInfo>
}

export type OAuthTokens = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
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

export type AuthError =
  | "PROVIDER_NOT_FOUND"
  | "TOKEN_EXCHANGE_FAILED"
  | "USER_INFO_FAILED"
  | "DB_ERROR"
