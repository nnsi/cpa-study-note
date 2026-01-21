import { ReactNode } from "react"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { useAuthStore } from "@/lib/auth"

type Props = {
  children: ReactNode
}

export const Layout = ({ children }: Props) => {
  const { isAuthenticated } = useAuthStore()
  const loggedIn = isAuthenticated()

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        {/* PC: サイドバー表示（ログイン時のみ） */}
        {loggedIn && (
          <aside className="hidden lg:block w-72 min-h-[calc(100vh-72px)] border-r border-ink-100">
            <Sidebar />
          </aside>
        )}

        {/* メインコンテンツ */}
        <main
          className={`flex-1 min-h-[calc(100vh-72px)] ${loggedIn ? "pb-20 lg:pb-0" : ""}`}
        >
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* モバイル: ボトムナビ（ログイン時のみ） */}
      {loggedIn && <BottomNav />}
    </div>
  )
}
