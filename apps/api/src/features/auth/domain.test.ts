import { describe, it, expect } from "vitest"
import type {
  User,
  UserOAuthConnection,
  RefreshToken,
  AuthError,
  OAuthTokens,
  OAuthUserInfo,
} from "./domain"

describe("Auth Domain Types", () => {
  describe("User type", () => {
    it("should accept valid User object", () => {
      const user: User = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        timezone: "Asia/Tokyo",
        defaultStudyDomainId: "cpa",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(user.id).toBe("user-123")
      expect(user.email).toBe("test@example.com")
      expect(user.name).toBe("Test User")
      expect(user.avatarUrl).toBe("https://example.com/avatar.png")
      expect(user.timezone).toBe("Asia/Tokyo")
      expect(user.defaultStudyDomainId).toBe("cpa")
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it("should accept null avatarUrl", () => {
      const user: User = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        timezone: "Asia/Tokyo",
        defaultStudyDomainId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(user.avatarUrl).toBeNull()
      expect(user.defaultStudyDomainId).toBeNull()
    })
  })

  describe("UserOAuthConnection type", () => {
    it("should accept valid UserOAuthConnection object", () => {
      const connection: UserOAuthConnection = {
        id: "conn-123",
        userId: "user-123",
        provider: "google",
        providerId: "google-user-id",
        createdAt: new Date(),
      }

      expect(connection.id).toBe("conn-123")
      expect(connection.userId).toBe("user-123")
      expect(connection.provider).toBe("google")
      expect(connection.providerId).toBe("google-user-id")
      expect(connection.createdAt).toBeInstanceOf(Date)
    })
  })

  describe("RefreshToken type", () => {
    it("should accept valid RefreshToken object", () => {
      const token: RefreshToken = {
        id: "token-123",
        userId: "user-123",
        tokenHash: "hashed-token-value",
        expiresAt: new Date("2025-12-31"),
        createdAt: new Date(),
      }

      expect(token.id).toBe("token-123")
      expect(token.userId).toBe("user-123")
      expect(token.tokenHash).toBe("hashed-token-value")
      expect(token.expiresAt).toBeInstanceOf(Date)
      expect(token.createdAt).toBeInstanceOf(Date)
    })

    it("should handle expired tokens", () => {
      const expiredToken: RefreshToken = {
        id: "token-expired",
        userId: "user-123",
        tokenHash: "hashed-token",
        expiresAt: new Date("2020-01-01"),
        createdAt: new Date("2019-01-01"),
      }

      expect(expiredToken.expiresAt.getTime()).toBeLessThan(Date.now())
    })
  })

  describe("AuthError type", () => {
    it("should cover all error types", () => {
      const errors: AuthError[] = [
        "PROVIDER_NOT_FOUND",
        "TOKEN_EXCHANGE_FAILED",
        "USER_INFO_FAILED",
        "DB_ERROR",
        "INVALID_REFRESH_TOKEN",
        "REFRESH_TOKEN_EXPIRED",
      ]

      // Verify exhaustive check
      const errorHandler = (error: AuthError): string => {
        switch (error) {
          case "PROVIDER_NOT_FOUND":
            return "Provider not found"
          case "TOKEN_EXCHANGE_FAILED":
            return "Token exchange failed"
          case "USER_INFO_FAILED":
            return "User info failed"
          case "DB_ERROR":
            return "Database error"
          case "INVALID_REFRESH_TOKEN":
            return "Invalid refresh token"
          case "REFRESH_TOKEN_EXPIRED":
            return "Refresh token expired"
          default: {
            // This ensures exhaustive check at compile time
            const _exhaustive: never = error
            return _exhaustive
          }
        }
      }

      errors.forEach((error) => {
        expect(typeof errorHandler(error)).toBe("string")
      })
    })

    it("should be assignable from literal strings", () => {
      const err1: AuthError = "PROVIDER_NOT_FOUND"
      const err2: AuthError = "TOKEN_EXCHANGE_FAILED"
      const err3: AuthError = "USER_INFO_FAILED"
      const err4: AuthError = "DB_ERROR"
      const err5: AuthError = "INVALID_REFRESH_TOKEN"
      const err6: AuthError = "REFRESH_TOKEN_EXPIRED"

      expect(err1).toBe("PROVIDER_NOT_FOUND")
      expect(err2).toBe("TOKEN_EXCHANGE_FAILED")
      expect(err3).toBe("USER_INFO_FAILED")
      expect(err4).toBe("DB_ERROR")
      expect(err5).toBe("INVALID_REFRESH_TOKEN")
      expect(err6).toBe("REFRESH_TOKEN_EXPIRED")
    })
  })

  describe("OAuthTokens type", () => {
    it("should accept minimal OAuthTokens", () => {
      const tokens: OAuthTokens = {
        access_token: "access-token-value",
      }

      expect(tokens.access_token).toBe("access-token-value")
      expect(tokens.refresh_token).toBeUndefined()
      expect(tokens.expires_in).toBeUndefined()
    })

    it("should accept full OAuthTokens", () => {
      const tokens: OAuthTokens = {
        access_token: "access-token-value",
        refresh_token: "refresh-token-value",
        expires_in: 3600,
        token_type: "Bearer",
        id_token: "id-token-for-oidc",
      }

      expect(tokens.access_token).toBe("access-token-value")
      expect(tokens.refresh_token).toBe("refresh-token-value")
      expect(tokens.expires_in).toBe(3600)
      expect(tokens.token_type).toBe("Bearer")
      expect(tokens.id_token).toBe("id-token-for-oidc")
    })
  })

  describe("OAuthUserInfo type", () => {
    it("should accept valid OAuthUserInfo", () => {
      const userInfo: OAuthUserInfo = {
        providerId: "provider-user-123",
        email: "user@example.com",
        name: "OAuth User",
        avatarUrl: "https://example.com/avatar.jpg",
      }

      expect(userInfo.providerId).toBe("provider-user-123")
      expect(userInfo.email).toBe("user@example.com")
      expect(userInfo.name).toBe("OAuth User")
      expect(userInfo.avatarUrl).toBe("https://example.com/avatar.jpg")
    })

    it("should accept null avatarUrl", () => {
      const userInfo: OAuthUserInfo = {
        providerId: "provider-user-123",
        email: "user@example.com",
        name: "OAuth User",
        avatarUrl: null,
      }

      expect(userInfo.avatarUrl).toBeNull()
    })
  })
})
