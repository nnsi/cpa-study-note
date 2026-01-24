import { describe, it, expect, beforeEach } from "vitest"
import { createTestDatabase, seedTestData } from "../../test/mocks/db"
import { createAuthRepository, type AuthRepository } from "./repository"

describe("AuthRepository", () => {
  let repository: AuthRepository
  let testData: ReturnType<typeof seedTestData>
  let resetDb: () => void

  beforeEach(() => {
    const { db, sqlite } = createTestDatabase()
    testData = seedTestData(db)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository = createAuthRepository(db as any)
    resetDb = () => sqlite.close()
  })

  describe("findUserById", () => {
    it("should return user when exists", async () => {
      const user = await repository.findUserById(testData.userId)

      expect(user).not.toBeNull()
      expect(user?.id).toBe(testData.userId)
      expect(user?.email).toBe("test@example.com")
      expect(user?.name).toBe("Test User")
    })

    it("should return null when user does not exist", async () => {
      const user = await repository.findUserById("non-existent-id")

      expect(user).toBeNull()
    })
  })

  describe("findUserByEmail", () => {
    it("should return user when exists", async () => {
      const user = await repository.findUserByEmail("test@example.com")

      expect(user).not.toBeNull()
      expect(user?.id).toBe(testData.userId)
      expect(user?.email).toBe("test@example.com")
    })

    it("should return null when email does not exist", async () => {
      const user = await repository.findUserByEmail("nonexistent@example.com")

      expect(user).toBeNull()
    })
  })

  describe("createUser", () => {
    it("should create user and return with id", async () => {
      const userData = {
        email: "newuser@example.com",
        name: "New User",
        avatarUrl: "https://example.com/avatar.png",
      }

      const created = await repository.createUser(userData)

      expect(created.id).toBeDefined()
      expect(created.email).toBe(userData.email)
      expect(created.name).toBe(userData.name)
      expect(created.avatarUrl).toBe(userData.avatarUrl)
      expect(created.createdAt).toBeInstanceOf(Date)
      expect(created.updatedAt).toBeInstanceOf(Date)

      // 実際にDBに保存されていることを確認
      const found = await repository.findUserById(created.id)
      expect(found).not.toBeNull()
      expect(found?.email).toBe(userData.email)
    })

    it("should create user with null avatarUrl", async () => {
      const userData = {
        email: "noavatar@example.com",
        name: "No Avatar User",
        avatarUrl: null,
      }

      const created = await repository.createUser(userData)

      expect(created.avatarUrl).toBeNull()
    })
  })

  describe("findConnectionByProviderAndId", () => {
    it("should return connection when exists", async () => {
      // まず接続を作成
      const connection = await repository.createConnection({
        userId: testData.userId,
        provider: "google",
        providerId: "google-123",
      })

      const found = await repository.findConnectionByProviderAndId(
        "google",
        "google-123"
      )

      expect(found).not.toBeNull()
      expect(found?.id).toBe(connection.id)
      expect(found?.provider).toBe("google")
      expect(found?.providerId).toBe("google-123")
    })

    it("should return null when connection does not exist", async () => {
      const found = await repository.findConnectionByProviderAndId(
        "google",
        "non-existent"
      )

      expect(found).toBeNull()
    })
  })

  describe("createConnection", () => {
    it("should create OAuth connection", async () => {
      const connectionData = {
        userId: testData.userId,
        provider: "google",
        providerId: "google-user-456",
      }

      const created = await repository.createConnection(connectionData)

      expect(created.id).toBeDefined()
      expect(created.userId).toBe(testData.userId)
      expect(created.provider).toBe("google")
      expect(created.providerId).toBe("google-user-456")
      expect(created.createdAt).toBeInstanceOf(Date)

      // 検索して確認
      const found = await repository.findConnectionByProviderAndId(
        "google",
        "google-user-456"
      )
      expect(found).not.toBeNull()
    })
  })

  describe("saveRefreshToken", () => {
    it("should save refresh token", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const tokenData = {
        userId: testData.userId,
        tokenHash: "hashed-token-123",
        expiresAt,
      }

      const saved = await repository.saveRefreshToken(tokenData)

      expect(saved.id).toBeDefined()
      expect(saved.userId).toBe(testData.userId)
      expect(saved.tokenHash).toBe("hashed-token-123")
      expect(saved.createdAt).toBeInstanceOf(Date)

      // 検索して確認
      const found = await repository.findRefreshTokenByHash("hashed-token-123")
      expect(found).not.toBeNull()
      expect(found?.id).toBe(saved.id)
    })
  })

  describe("findRefreshTokenByHash", () => {
    it("should return token when exists", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await repository.saveRefreshToken({
        userId: testData.userId,
        tokenHash: "find-me-token",
        expiresAt,
      })

      const found = await repository.findRefreshTokenByHash("find-me-token")

      expect(found).not.toBeNull()
      expect(found?.tokenHash).toBe("find-me-token")
      expect(found?.userId).toBe(testData.userId)
    })

    it("should return null when token does not exist", async () => {
      const found =
        await repository.findRefreshTokenByHash("non-existent-token")

      expect(found).toBeNull()
    })
  })

  describe("deleteRefreshToken", () => {
    it("should delete token by id", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const saved = await repository.saveRefreshToken({
        userId: testData.userId,
        tokenHash: "delete-me-token",
        expiresAt,
      })

      await repository.deleteRefreshToken(saved.id)

      const found = await repository.findRefreshTokenByHash("delete-me-token")
      expect(found).toBeNull()
    })
  })

  describe("deleteAllUserRefreshTokens", () => {
    it("should delete all tokens for user", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      // 複数のトークンを保存
      await repository.saveRefreshToken({
        userId: testData.userId,
        tokenHash: "token-1",
        expiresAt,
      })
      await repository.saveRefreshToken({
        userId: testData.userId,
        tokenHash: "token-2",
        expiresAt,
      })
      await repository.saveRefreshToken({
        userId: testData.userId,
        tokenHash: "token-3",
        expiresAt,
      })

      await repository.deleteAllUserRefreshTokens(testData.userId)

      // 全て削除されていることを確認
      expect(await repository.findRefreshTokenByHash("token-1")).toBeNull()
      expect(await repository.findRefreshTokenByHash("token-2")).toBeNull()
      expect(await repository.findRefreshTokenByHash("token-3")).toBeNull()
    })
  })
})
