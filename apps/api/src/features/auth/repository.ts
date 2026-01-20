import { eq, and } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { users, userOAuthConnections } from "@cpa-study/db/schema"
import type { User, UserOAuthConnection } from "./domain"

export type AuthRepository = {
  findUserById: (id: string) => Promise<User | null>
  findUserByEmail: (email: string) => Promise<User | null>
  createUser: (user: Omit<User, "id" | "createdAt" | "updatedAt">) => Promise<User>
  findConnectionByProviderAndId: (
    provider: string,
    providerId: string
  ) => Promise<UserOAuthConnection | null>
  createConnection: (
    connection: Omit<UserOAuthConnection, "id" | "createdAt">
  ) => Promise<UserOAuthConnection>
}

export const createAuthRepository = (db: Db): AuthRepository => ({
  findUserById: async (id) => {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return result[0] ?? null
  },

  findUserByEmail: async (email) => {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    return result[0] ?? null
  },

  createUser: async (user) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(users).values({
      id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: now,
      updatedAt: now,
    }
  },

  findConnectionByProviderAndId: async (provider, providerId) => {
    const result = await db
      .select()
      .from(userOAuthConnections)
      .where(
        and(
          eq(userOAuthConnections.provider, provider),
          eq(userOAuthConnections.providerId, providerId)
        )
      )
      .limit(1)
    return result[0] ?? null
  },

  createConnection: async (connection) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(userOAuthConnections).values({
      id,
      userId: connection.userId,
      provider: connection.provider,
      providerId: connection.providerId,
      createdAt: now,
    })

    return {
      id,
      userId: connection.userId,
      provider: connection.provider,
      providerId: connection.providerId,
      createdAt: now,
    }
  },
})
