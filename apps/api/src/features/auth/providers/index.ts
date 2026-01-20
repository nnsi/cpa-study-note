import type { OAuthProvider } from "../domain"
import { createGoogleProvider } from "./google"
import type { Env } from "@/shared/types/env"

export const createProviders = (env: Env) => {
  const providers: Record<string, OAuthProvider> = {}

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = createGoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${env.API_BASE_URL}/api/auth/google/callback`,
    })
  }

  return {
    get: (name: string) => providers[name],
    list: () => Object.keys(providers),
  }
}
