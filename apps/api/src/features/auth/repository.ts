import { eq, and } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { users, userOAuthConnections, refreshTokens } from "@cpa-study/db/schema"
import type { User, UserOAuthConnection, RefreshToken } from "./domain"

type CreateUserInput = {
  email: string
  name: string
  avatarUrl: string | null
  timezone?: string
}

type UpdateUserInput = {
  name?: string
  avatarUrl?: string | null
  timezone?: string
  defaultStudyDomainId?: string | null
}

export type AuthRepository = {
  findUserById: (id: string) => Promise<User | null>
  findUserByEmail: (email: string) => Promise<User | null>
  createUser: (user: CreateUserInput) => Promise<User>
  createUserWithId: (id: string, user: CreateUserInput) => Promise<User>
  updateUser: (id: string, data: UpdateUserInput) => Promise<User | null>
  findConnectionByProviderAndId: (
    provider: string,
    providerId: string
  ) => Promise<UserOAuthConnection | null>
  createConnection: (
    connection: Omit<UserOAuthConnection, "id" | "createdAt">
  ) => Promise<UserOAuthConnection>
  // Refresh Token
  saveRefreshToken: (token: Omit<RefreshToken, "id" | "createdAt">) => Promise<RefreshToken>
  findRefreshTokenByHash: (tokenHash: string) => Promise<RefreshToken | null>
  deleteRefreshToken: (id: string) => Promise<void>
  deleteAllUserRefreshTokens: (userId: string) => Promise<void>
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
    const timezone = user.timezone ?? "Asia/Tokyo"

    await db.insert(users).values({
      id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      timezone,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      timezone,
      defaultStudyDomainId: null,
      createdAt: now,
      updatedAt: now,
    }
  },

  createUserWithId: async (id, user) => {
    const now = new Date()
    const timezone = user.timezone ?? "Asia/Tokyo"

    await db.insert(users).values({
      id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      timezone,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      timezone,
      defaultStudyDomainId: null,
      createdAt: now,
      updatedAt: now,
    }
  },

  updateUser: async (id, data) => {
    const existing = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!existing[0]) return null

    const now = new Date()
    const updates: Record<string, unknown> = { updatedAt: now }

    if (data.name !== undefined) updates.name = data.name
    if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl
    if (data.timezone !== undefined) updates.timezone = data.timezone
    if (data.defaultStudyDomainId !== undefined) updates.defaultStudyDomainId = data.defaultStudyDomainId

    await db.update(users).set(updates).where(eq(users.id, id))

    return {
      ...existing[0],
      ...updates,
      updatedAt: now,
    } as User
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

  saveRefreshToken: async (token) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(refreshTokens).values({
      id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: now,
    })

    return {
      id,
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      createdAt: now,
    }
  },

  findRefreshTokenByHash: async (tokenHash) => {
    const result = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1)
    return result[0] ?? null
  },

  deleteRefreshToken: async (id) => {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, id))
  },

  deleteAllUserRefreshTokens: async (userId) => {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
  },
})
