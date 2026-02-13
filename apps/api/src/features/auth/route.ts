import { Hono } from "hono"
import { setCookie, getCookie } from "hono/cookie"
import { SignJWT } from "jose"
import type { Db } from "@cpa-study/db"
import type { Env, Variables, User } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAuthRepository } from "./repository"
import { createProviders } from "./providers"
import { handleOAuthCallback, refreshAccessToken, getOrCreateDevUser, saveRefreshToken, logout } from "./usecase"
import { handleResult } from "@/shared/lib/route-helpers"
import { notFound, badRequest, unauthorized } from "@/shared/lib/errors"

// Token expiration times
const ACCESS_TOKEN_EXPIRES_IN = "15m"
const REFRESH_TOKEN_EXPIRES_DAYS = 30

type AuthDeps = {
  env: Env
  db: Db
}

// Generate access token (short-lived, returned in response body)
const generateAccessToken = async (user: User, secret: Uint8Array) => {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    defaultStudyDomainId: user.defaultStudyDomainId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRES_IN)
    .sign(secret)
}

// Generate refresh token (long-lived, stored in HttpOnly cookie)
const generateRefreshToken = () => {
  // Generate a random token
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

// Hash refresh token for storage
const hashToken = async (token: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const authRoutes = ({ env, db }: AuthDeps) => {
  const repo = createAuthRepository(db)
  const providers = createProviders(env)
  const jwtSecret = new TextEncoder().encode(env.JWT_SECRET)

  // Validate JWT_SECRET strength (32+ bytes required in production)
  if (env.ENVIRONMENT !== "local" && env.JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters in production/staging environment"
    )
  }

  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
    // 利用可能プロバイダー一覧
    .get("/providers", (c) => {
      return c.json({ providers: providers.list() })
    })

    // ユーザー情報取得（/:providerより先に定義）
    .get("/me", authMiddleware, (c) => {
      const user = c.get("user")
      return c.json({ user })
    })

    // OAuth開始
    .get("/:provider", (c) => {
      const providerName = c.req.param("provider")
      const provider = providers.get(providerName)

      if (!provider) {
        return handleResult(c, { ok: false, error: notFound("Provider not found") })
      }

      const state = crypto.randomUUID()
      setCookie(c, "oauth_state", state, {
        httpOnly: true,
        secure: env.ENVIRONMENT !== "local",
        sameSite: "Lax",
        maxAge: 600,
        path: "/",
      })

      const authUrl = provider.getAuthUrl(state)
      return c.redirect(authUrl)
    })

    // OAuthコールバック
    .get("/:provider/callback", async (c) => {
      const providerName = c.req.param("provider")
      const code = c.req.query("code")
      const state = c.req.query("state")
      const storedState = getCookie(c, "oauth_state")

      if (!code) {
        return handleResult(c, { ok: false, error: badRequest("Missing code") })
      }

      if (state !== storedState) {
        return handleResult(c, { ok: false, error: badRequest("Invalid state") })
      }

      const logger = c.get("logger").child({ feature: "auth" })
      const result = await handleOAuthCallback(
        { repo, providers, db, logger },
        providerName,
        code
      )

      if (!result.ok) {
        return handleResult(c, result)
      }

      const user = result.value.user

      // Generate tokens
      const accessToken = await generateAccessToken(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          timezone: user.timezone,
          defaultStudyDomainId: user.defaultStudyDomainId,
        },
        jwtSecret
      )
      const refreshToken = generateRefreshToken()
      const refreshTokenHash = await hashToken(refreshToken)

      // Save refresh token to DB（UseCase経由）
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS)
      const saveResult = await saveRefreshToken(
        { repo, logger },
        {
          userId: user.id,
          tokenHash: refreshTokenHash,
          expiresAt,
        }
      )

      if (!saveResult.ok) {
        return handleResult(c, saveResult)
      }

      // Set refresh token in HttpOnly cookie
      setCookie(c, "refresh_token", refreshToken, {
        httpOnly: true,
        secure: env.ENVIRONMENT !== "local",
        sameSite: "Strict",
        maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60,
        path: "/api/auth",
      })

      // Clear oauth state cookie
      setCookie(c, "oauth_state", "", {
        httpOnly: true,
        secure: env.ENVIRONMENT !== "local",
        sameSite: "Lax",
        maxAge: 0,
        path: "/",
      })

      // Redirect with access token in URL fragment (for SPA to capture)
      const redirectUrl = new URL(
        "/auth/callback",
        env.WEB_BASE_URL || "http://localhost:5174"
      )
      redirectUrl.hash = `token=${accessToken}`
      return c.redirect(redirectUrl.toString())
    })

    // トークン更新 (refresh token in cookie)
    .post("/refresh", async (c) => {
      const refreshToken = getCookie(c, "refresh_token")

      if (!refreshToken) {
        return handleResult(c, { ok: false, error: unauthorized("No refresh token") })
      }

      const logger = c.get("logger").child({ feature: "auth" })
      const result = await refreshAccessToken(
        { repo, logger },
        refreshToken,
        jwtSecret,
        generateAccessToken
      )

      if (!result.ok) {
        // Clear invalid refresh token
        setCookie(c, "refresh_token", "", {
          httpOnly: true,
          secure: env.ENVIRONMENT !== "local",
          sameSite: "Strict",
          maxAge: 0,
          path: "/api/auth",
        })
        return handleResult(c, result)
      }

      return c.json({
        accessToken: result.value.accessToken,
        user: result.value.user,
      })
    })

    // 開発用ログイン（ローカル環境のみ）
    .post("/dev-login", async (c) => {
      // ローカル環境以外では無効
      if (env.ENVIRONMENT !== "local") {
        return handleResult(c, { ok: false, error: notFound("Not available") })
      }

      const devUserId = env.DEV_USER_ID || "test-user-1"

      // ユーザーが存在しない場合は作成（UseCase経由）
      const logger = c.get("logger").child({ feature: "auth" })
      const userResult = await getOrCreateDevUser(
        { repo, logger },
        {
          userId: devUserId,
          email: `${devUserId}@example.com`,
          name: "テストユーザー",
          avatarUrl: null,
          timezone: "Asia/Tokyo",
        }
      )

      if (!userResult.ok) {
        return handleResult(c, userResult)
      }

      const existingUser = userResult.value
      const devUser: User = {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        avatarUrl: existingUser.avatarUrl,
        timezone: existingUser.timezone,
        defaultStudyDomainId: existingUser.defaultStudyDomainId,
      }

      // Generate tokens (本番と同じフロー)
      const accessToken = await generateAccessToken(devUser, jwtSecret)
      const refreshToken = generateRefreshToken()
      const refreshTokenHash = await hashToken(refreshToken)

      // Save refresh token to DB（UseCase経由）
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS)
      const saveResult = await saveRefreshToken(
        { repo, logger },
        {
          userId: devUser.id,
          tokenHash: refreshTokenHash,
          expiresAt,
        }
      )

      if (!saveResult.ok) {
        return handleResult(c, saveResult)
      }

      // Set refresh token in HttpOnly cookie
      setCookie(c, "refresh_token", refreshToken, {
        httpOnly: true,
        secure: false, // ローカル環境なのでHTTPでもOK
        sameSite: "Strict",
        maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60,
        path: "/api/auth",
      })

      return c.json({
        accessToken,
        user: devUser,
      })
    })

    // ログアウト
    .post("/logout", async (c) => {
      const refreshToken = getCookie(c, "refresh_token")
      const logger = c.get("logger").child({ feature: "auth" })

      if (refreshToken) {
        // Delete refresh token from DB（UseCase経由）
        const tokenHash = await hashToken(refreshToken)
        const logoutResult = await logout({ repo, logger }, tokenHash)
        // エラーが発生してもクッキーはクリアする（ログ出力のみ）
        if (!logoutResult.ok) {
          logger.error("Logout DB error", { error: logoutResult.error })
        }
      }

      // Clear refresh token cookie
      setCookie(c, "refresh_token", "", {
        httpOnly: true,
        secure: env.ENVIRONMENT !== "local",
        sameSite: "Strict",
        maxAge: 0,
        path: "/api/auth",
      })

      return c.json({ success: true })
    })

  return app
}
