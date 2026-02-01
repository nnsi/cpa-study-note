import { Link } from "@tanstack/react-router"
import { useAuthStore, logout } from "@/lib/auth"
import { DomainSelector } from "@/features/study-domain"

type HeaderProps = {
  onSearchClick?: () => void
}

export const Header = ({ onSearchClick }: HeaderProps) => {
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
            {/* 検索ボタン */}
            <button
              onClick={onSearchClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-ink-50 hover:bg-ink-100
                         rounded-lg text-ink-500 hover:text-ink-700 transition-colors"
              title="検索 (Ctrl+K)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <span className="hidden sm:inline text-sm">検索</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5
                              bg-ink-100 rounded text-xs text-ink-400">
                <span className="text-2xs">⌘</span>K
              </kbd>
            </button>
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
