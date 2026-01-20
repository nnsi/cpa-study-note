import { Link } from "@tanstack/react-router"
import { useAuthStore } from "@/lib/auth"

export const Header = () => {
  const { user, isAuthenticated, clearAuth } = useAuthStore()

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-6">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-xl font-bold text-blue-600">CPA Study</span>
      </Link>

      <div className="flex items-center gap-4">
        {isAuthenticated() && user ? (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-gray-600">
              {user.displayName || user.email}
            </span>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-sm text-blue-600">
                  {(user.displayName || user.email)[0].toUpperCase()}
                </span>
              </div>
            )}
            <button
              onClick={clearAuth}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn-primary text-sm">
            ログイン
          </Link>
        )}
      </div>
    </header>
  )
}
