import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useAuthStore, logout } from "@/lib/auth"
import { DomainSelector } from "@/features/study-domain"

type HeaderProps = {
  onSearchClick?: () => void
}

export const Header = ({ onSearchClick }: HeaderProps) => {
  const { user, isAuthenticated } = useAuthStore()
  const loggedIn = isAuthenticated()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

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

            {/* アバター + ドロップダウン */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="focus:outline-none rounded-xl"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-xl shadow-soft ring-2 ring-white hover:ring-indigo-200 transition-shadow"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center shadow-soft ring-2 ring-white hover:ring-indigo-200 transition-shadow">
                    <span className="text-sm font-semibold text-indigo-600">
                      {(user.displayName || user.email || "U")[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-ink-100 py-1 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate({ to: "/edit" })
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                    </svg>
                    学習領域管理
                  </button>
                  <div className="border-t border-ink-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      logout()
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-crimson-600 hover:bg-crimson-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
