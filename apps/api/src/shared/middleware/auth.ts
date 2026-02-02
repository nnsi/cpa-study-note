import { createMiddleware } from "hono/factory"
import { jwtVerify } from "jose"
import type { Env, User, Variables } from "../types/env"

type AuthContext = {
  Bindings: Env
  Variables: Variables
}

export const authMiddleware = createMiddleware<AuthContext>(async (c, next) => {
  // ローカル環境 + X-Dev-User-Id ヘッダーがある場合のみ認証スキップ（curl等からのテスト用）
  if (c.env.ENVIRONMENT === "local" && c.req.header("X-Dev-User-Id")) {
    const devUser = getDevUser(c)
    c.set("user", devUser)
    return next()
  }

  // 本番モード: JWT検証
  const token = c.req.header("Authorization")?.replace("Bearer ", "")
  if (!token) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "認証が必要です" } }, 401)
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    const user: User = {
      id: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      avatarUrl: (payload.avatarUrl as string) || null,
      timezone: (payload.timezone as string) || "Asia/Tokyo",
      defaultStudyDomainId: (payload.defaultStudyDomainId as string) || null,
    }

    c.set("user", user)
    return next()
  } catch {
    return c.json({ error: { code: "UNAUTHORIZED", message: "無効なトークンです" } }, 401)
  }
})

const getDevUser = (c: { req: { header: (name: string) => string | undefined }; env: Env }): User => {
  const userId = c.req.header("X-Dev-User-Id") ?? c.env.DEV_USER_ID ?? "test-user-1"
  const userName = c.req.header("X-Dev-User-Name") ?? "テストユーザー"

  return {
    id: userId,
    email: `${userId}@example.com`,
    name: userName,
    avatarUrl: null,
    timezone: "Asia/Tokyo",
    defaultStudyDomainId: null,
  }
}

// オプショナル認証: 認証があればユーザー情報をセット、なくても続行
export const optionalAuthMiddleware = createMiddleware<AuthContext>(
  async (c, next) => {
    // ローカル環境 + X-Dev-User-Id ヘッダーがある場合のみ認証スキップ（curl等からのテスト用）
    if (c.env.ENVIRONMENT === "local" && c.req.header("X-Dev-User-Id")) {
      const devUser = getDevUser(c)
      c.set("user", devUser)
      return next()
    }

    // 本番モード: JWT検証（失敗しても続行）
    const token = c.req.header("Authorization")?.replace("Bearer ", "")
    if (!token) {
      return next()
    }

    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET)
      const { payload } = await jwtVerify(token, secret)

      const user: User = {
        id: payload.sub as string,
        email: payload.email as string,
        name: payload.name as string,
        avatarUrl: (payload.avatarUrl as string) || null,
        timezone: (payload.timezone as string) || "Asia/Tokyo",
        defaultStudyDomainId: (payload.defaultStudyDomainId as string) || null,
      }

      c.set("user", user)
    } catch {
      // 無効なトークンでも続行
    }

    return next()
  }
)
