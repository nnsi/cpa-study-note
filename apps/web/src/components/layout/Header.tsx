import { Link } from "@tanstack/react-router"
import { useAuthStore, logout } from "@/lib/auth"
import { DomainSelector } from "@/features/study-domain"

export const Header = () => {
  const { user, isAuthenticated } = useAuthStore()
  const loggedIn = isAuthenticated()

  return (
    <header className="sticky top-0 z-50 h-18 glass border-b border-ink-100">
      <div className="h-full max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between">
        {/* ロゴ + 学習領域セレクタ */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center group">
            <span className="text-xl font-serif font-semibold text-ink-900 tracking-tight group-hover:text-indigo-700 transition-colors">
              InkTopik
            </span>
          </Link>

          {/* 学習領域セレクタ（ログイン時のみ） */}
          {loggedIn && (
            <>
              <span className="text-ink-200">/</span>
              <DomainSelector />
            </>
          )}
        </div>

        {/* ユーザー情報 */}
        {loggedIn && user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-ink-700">
                {user.displayName || user.email?.split("@")[0]}
              </span>
              <span className="text-2xs text-ink-400">学習中</span>
            </div>

            {/* アバター */}
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-10 h-10 rounded-xl shadow-soft ring-2 ring-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center shadow-soft ring-2 ring-white">
                <span className="text-sm font-semibold text-indigo-600">
                  {(user.displayName || user.email || "U")[0].toUpperCase()}
                </span>
              </div>
            )}

            {/* ログアウトボタン */}
            <button
              onClick={logout}
              className="btn-ghost text-sm text-ink-500 hover:text-crimson-500"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
