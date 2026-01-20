import { Hono } from "hono"
import { setCookie, getCookie } from "hono/cookie"
import { SignJWT } from "jose"
import type { Db } from "@cpa-study/db"
import type { Env, Variables } from "@/shared/types/env"
import { authMiddleware } from "@/shared/middleware/auth"
import { createAuthRepository } from "./repository"
import { createProviders } from "./providers"
import { handleOAuthCallback } from "./usecase"

type AuthDeps = {
  env: Env
  db: Db
}

export const authRoutes = ({ env, db }: AuthDeps) => {
  const repo = createAuthRepository(db)
  const providers = createProviders(env)

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
        return c.json({ error: "Provider not found" }, 404)
      }

      const state = crypto.randomUUID()
      setCookie(c, "oauth_state", state, {
        httpOnly: true,
        secure: true,
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
        return c.json({ error: "Missing code" }, 400)
      }

      if (state !== storedState) {
        return c.json({ error: "Invalid state" }, 400)
      }

      const result = await handleOAuthCallback(
        { repo, providers },
        providerName,
        code
      )

      if (!result.ok) {
        const statusMap: Record<string, 401 | 404 | 500> = {
          PROVIDER_NOT_FOUND: 404,
          TOKEN_EXCHANGE_FAILED: 401,
          USER_INFO_FAILED: 401,
          DB_ERROR: 500,
        }
        return c.json({ error: result.error }, statusMap[result.error] ?? 500)
      }

      // JWT生成
      const secret = new TextEncoder().encode(env.JWT_SECRET)
      const token = await new SignJWT({
        sub: result.value.user.id,
        email: result.value.user.email,
        name: result.value.user.name,
        avatarUrl: result.value.user.avatarUrl,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret)

      // Cookieにトークンを設定
      setCookie(c, "auth_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      })

      // フロントエンドにリダイレクト
      return c.redirect(env.WEB_BASE_URL || "/")
    })

    // トークン更新
    .post("/refresh", authMiddleware, async (c) => {
      const user = c.get("user")

      const secret = new TextEncoder().encode(env.JWT_SECRET)
      const token = await new SignJWT({
        sub: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret)

      setCookie(c, "auth_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      })

      return c.json({ token })
    })

    // ログアウト
    .post("/logout", (c) => {
      setCookie(c, "auth_token", "", {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: 0,
        path: "/",
      })
      return c.json({ success: true })
    })

  return app
}
