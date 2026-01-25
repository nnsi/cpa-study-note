import { Link } from "@tanstack/react-router"
import { useRecentTopics } from "../hooks"

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "たった今"
  if (diffMins < 60) return `${diffMins}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 7) return `${diffDays}日前`

  return date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  })
}

export const RecentTopicsList = () => {
  const { topics, isLoading } = useRecentTopics()

  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="heading-serif text-lg">最近の論点</h3>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h3 className="heading-serif text-lg">最近の論点</h3>
        </div>
        <div className="text-center py-8 text-ink-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-sm">まだ論点にアクセスしていません</p>
          <Link to="/subjects" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mt-2 inline-block">
            論点マップを見る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h3 className="heading-serif text-lg">最近の論点</h3>
        </div>
        <Link
          to="/subjects"
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          すべて見る
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      <div className="space-y-2">
        {topics.map((topic) => (
          <Link
            key={topic.topicId}
            to="/subjects/$subjectId/$categoryId/$topicId"
            params={{
              subjectId: topic.subjectId,
              categoryId: topic.categoryId,
              topicId: topic.topicId,
            }}
            className="group flex items-center justify-between p-3 rounded-xl hover:bg-ink-50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink-900 truncate group-hover:text-indigo-700 transition-colors">
                {topic.topicName}
              </p>
              <p className="text-xs text-ink-500 mt-0.5">{topic.subjectName}</p>
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              <span className="text-xs text-ink-400">{formatRelativeTime(topic.lastAccessedAt)}</span>
              <svg
                className="w-4 h-4 text-ink-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
