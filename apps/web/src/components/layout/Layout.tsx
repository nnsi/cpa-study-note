import { ReactNode } from "react"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"

type Props = {
  children: ReactNode
}

export const Layout = ({ children }: Props) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        {/* PC: サイドバー表示 */}
        <aside className="hidden lg:block w-64 min-h-[calc(100vh-64px)] bg-white border-r">
          <Sidebar />
        </aside>

        {/* メインコンテンツ */}
        <main className="flex-1 pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      {/* モバイル: ボトムナビ */}
      <BottomNav />
    </div>
  )
}
