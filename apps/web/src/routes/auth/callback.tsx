import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { useAuthStore } from "@/lib/auth"

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
})

function AuthCallback() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    // Get token from URL fragment
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const token = params.get("token")

    if (token) {
      // Decode JWT to get user info
      try {
        const payload = JSON.parse(atob(token.split(".")[1]))
        const user = {
          id: payload.sub,
          email: payload.email,
          displayName: payload.name,
          avatarUrl: payload.avatarUrl,
        }
        setAuth(user, token)

        // Clear the hash from URL
        window.history.replaceState(null, "", window.location.pathname)

        // Redirect to home
        navigate({ to: "/" })
      } catch {
        // Invalid token, redirect to login
        navigate({ to: "/login" })
      }
    } else {
      // No token, redirect to login
      navigate({ to: "/login" })
    }
  }, [navigate, setAuth])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
        <p className="mt-4 text-gray-600">ログイン中...</p>
      </div>
    </div>
  )
}
