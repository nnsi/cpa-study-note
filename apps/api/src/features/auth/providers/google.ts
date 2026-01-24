import * as jose from "jose"
import type { OAuthProvider, OAuthTokens } from "../domain"

type GoogleConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

// Google OIDC公開鍵エンドポイント
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"

export const createGoogleProvider = (config: GoogleConfig): OAuthProvider => ({
  name: "google",

  getAuthUrl: (state) => {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  },

  exchangeCode: async (code) => {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    })

    if (!res.ok) {
      console.error(`[Google OAuth] Token exchange failed: ${res.status}`)
      throw new Error("Authentication failed")
    }

    return res.json()
  },

  getUserInfo: async (tokens: OAuthTokens) => {
    const { id_token } = tokens

    if (!id_token) {
      console.error("[Google OAuth] No ID token received")
      throw new Error("Failed to get user info")
    }

    try {
      // Google公開鍵でID Tokenを検証
      const JWKS = jose.createRemoteJWKSet(new URL(GOOGLE_JWKS_URI))
      const { payload } = await jose.jwtVerify(id_token, JWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: config.clientId,
      })

      const { sub, email, name, picture } = payload as {
        sub: string
        email?: string
        name?: string
        picture?: string
      }

      if (!sub || !email) {
        console.error("[Google OAuth] Missing required claims in ID token")
        throw new Error("Failed to get user info")
      }

      return {
        providerId: sub,
        email,
        name: name || email.split("@")[0],
        avatarUrl: picture ?? null,
      }
    } catch (error) {
      console.error("[Google OAuth] ID token verification failed:", error)
      throw new Error("Failed to get user info")
    }
  },
})
