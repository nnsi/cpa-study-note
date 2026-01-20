import type { OAuthProvider } from "../domain"

type GoogleConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

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
      throw new Error(`Token exchange failed: ${res.status}`)
    }

    return res.json()
  },

  getUserInfo: async (accessToken) => {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new Error(`User info failed: ${res.status}`)
    }

    const data = (await res.json()) as {
      id: string
      email: string
      name: string
      picture?: string
    }

    return {
      providerId: data.id,
      email: data.email,
      name: data.name,
      avatarUrl: data.picture ?? null,
    }
  },
})
