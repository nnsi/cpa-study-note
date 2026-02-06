import { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useAuthStore } from "@/lib/auth";

type Props = {
  children: ReactNode;
  onSearchClick?: () => void;
};

export const Layout = ({ children, onSearchClick }: Props) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const loggedIn = isAuthenticated();

  // モバイルでホーム以外はヘッダー非表示
  const isHome = location.pathname === "/";
  const showMobileHeader = isHome || !loggedIn;

  // モバイルでログイン時: BottomNavの高さ分の下パディング
  const mobileBottomPadding = loggedIn
    ? "pb-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))] lg:pb-0"
    : "";

  return (
    <div className="min-h-dvh flex flex-col">
      {/* PC: 常に表示、モバイル: ホームのみ表示 */}
      <div className={showMobileHeader ? "" : "hidden lg:block"}>
        <Header onSearchClick={onSearchClick} />
      </div>
      <div className="flex flex-1 min-h-0">
        {/* PC: サイドバー表示（ログイン時のみ） */}
        {loggedIn && (
          <aside className="hidden lg:block w-72 border-r border-ink-100 overflow-y-auto">
            <Sidebar />
          </aside>
        )}

        {/* メインコンテンツ */}
        <main
          className={`flex-1 min-h-0 min-w-0 ${mobileBottomPadding}`}
        >
          {children}
        </main>
      </div>

      {/* モバイル: ボトムナビ（ログイン時のみ） */}
      {loggedIn && <BottomNav onSearchClick={onSearchClick} />}
    </div>
  );
};
