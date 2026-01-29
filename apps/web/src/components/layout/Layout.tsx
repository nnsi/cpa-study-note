import { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useAuthStore } from "@/lib/auth";

type Props = {
  children: ReactNode;
};

export const Layout = ({ children }: Props) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const loggedIn = isAuthenticated();

  // モバイルでホーム以外はヘッダー非表示
  const isHome = location.pathname === "/";
  const showMobileHeader = isHome || !loggedIn;

  return (
    <div className="min-h-screen">
      {/* PC: 常に表示、モバイル: ホームのみ表示 */}
      <div className={showMobileHeader ? "" : "hidden lg:block"}>
        <Header />
      </div>
      <div className="flex">
        {/* PC: サイドバー表示（ログイン時のみ） */}
        {loggedIn && (
          <aside className="hidden lg:block w-72 min-h-[calc(100vh-72px)] border-r border-ink-100">
            <Sidebar />
          </aside>
        )}

        {/* メインコンテンツ */}
        <main
          className={`flex-1 overflow-x-hidden ${
            showMobileHeader
              ? `min-h-[calc(100dvh-72px)] ${loggedIn ? "lg:pb-0" : ""}`
              : `min-h-screen lg:min-h-[calc(100dvh-72px)] ${loggedIn ? "lg:pb-0" : ""}`
          }`}
        >
          {children}
        </main>
      </div>

      {/* モバイル: ボトムナビ（ログイン時のみ） */}
      {loggedIn && <BottomNav />}
    </div>
  );
};
