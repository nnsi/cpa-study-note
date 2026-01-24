import { Link } from "@tanstack/react-router"
import { useAuthStore, logout } from "@/lib/auth"

export const Header = () => {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <header className="sticky top-0 z-50 h-18 glass border-b border-ink-100">
      <div className="h-full max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between">
        {/* ロゴ */}
        <Link to="/" className="flex items-center gap-3 group">
          {/* 印章風のアイコン */}
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow duration-300">
            <span className="text-white font-serif font-bold text-lg">会</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-serif font-semibold text-ink-900 tracking-tight">
              CPA Study
            </span>
            <span className="text-2xs text-ink-400 tracking-wider hidden sm:block">
              公認会計士学習サポート
            </span>
          </div>
        </Link>

        {/* ユーザー情報 */}
        {isAuthenticated() && user && (
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
