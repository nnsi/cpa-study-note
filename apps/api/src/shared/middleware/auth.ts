import { createMiddleware } from "hono/factory"
import { jwtVerify } from "jose"
import type { Env, User, Variables } from "../types/env"

type AuthContext = {
  Bindings: Env
  Variables: Variables
}

export const authMiddleware = createMiddleware<AuthContext>(async (c, next) => {
  // 開発モード: 認証スキップ
  if (c.env.AUTH_MODE === "dev") {
    const devUser = getDevUser(c)
    c.set("user", devUser)
    return next()
  }

  // 本番モード: JWT検証
  const token = c.req.header("Authorization")?.replace("Bearer ", "")
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    const user: User = {
      id: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      avatarUrl: (payload.avatarUrl as string) || null,
    }

    c.set("user", user)
    return next()
  } catch {
    return c.json({ error: "Invalid token" }, 401)
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
  }
}
