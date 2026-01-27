import { Link, useLocation } from "@tanstack/react-router"
import { useRecentTopics } from "@/features/home"

const navItems = [
  {
    to: "/",
    label: "ホーム",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    to: "/subjects",
    label: "論点マップ",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    to: "/notes",
    label: "ノート",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
]

export const Sidebar = () => {
  const location = useLocation()
  const { topics: recentTopics, isLoading: isLoadingRecent } = useRecentTopics()

  return (
    <nav className="p-6">
      {/* セクションタイトル */}
      <div className="px-4 mb-4">
        <span className="label">メニュー</span>
      </div>

      {/* ナビゲーションリスト */}
      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to)

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={isActive ? "nav-item-active" : "nav-item"}
              >
                <span className={isActive ? "text-indigo-600" : "text-ink-400"}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* 装飾ライン */}
      <div className="mt-8 mb-6 divider" />

      {/* サブセクション */}
      <div className="px-4 mb-4">
        <span className="label">クイックアクセス</span>
      </div>

      <div className="px-2">
        {isLoadingRecent ? (
          <div className="space-y-1 px-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 skeleton rounded" />
            ))}
          </div>
        ) : recentTopics.length === 0 ? (
          <p className="text-sm text-ink-400 px-2">
            最近の学習がここに表示されます
          </p>
        ) : (
          <ul className="space-y-0.5">
            {recentTopics.slice(0, 5).map((topic) => (
              <li key={topic.topicId}>
                <Link
                  to="/subjects/$subjectId/$categoryId/$topicId"
                  params={{
                    subjectId: topic.subjectId,
                    categoryId: topic.categoryId,
                    topicId: topic.topicId,
                  }}
                  className="block px-3 py-2 text-sm text-ink-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors truncate"
                >
                  {topic.topicName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  )
}
