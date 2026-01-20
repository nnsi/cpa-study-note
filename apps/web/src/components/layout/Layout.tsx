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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        {/* PC: サイドバー表示（ログイン時のみ） */}
        {loggedIn && (
          <aside className="hidden lg:block w-64 min-h-[calc(100vh-64px)] bg-white border-r">
            <Sidebar />
          </aside>
        )}

        {/* メインコンテンツ */}
        <main className={`flex-1 ${loggedIn ? "pb-16 lg:pb-0" : ""}`}>
          {children}
        </main>
      </div>

      {/* モバイル: ボトムナビ（ログイン時のみ） */}
      {loggedIn && <BottomNav />}
    </div>
  )
}
