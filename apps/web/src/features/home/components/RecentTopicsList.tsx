import { Link } from "@tanstack/react-router"
import { useRecentTopics } from "../hooks"
import { useStudyDomains } from "@/features/study-domain"
import { formatRelativeTime } from "@/lib/date"

export const RecentTopicsList = () => {
  const { topics, isLoading } = useRecentTopics()
  const { studyDomains } = useStudyDomains()

  const subjectsTo =
    studyDomains.length === 1
      ? `/domains/${studyDomains[0].id}/subjects`
      : "/domains"

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
          <Link to={subjectsTo} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mt-2 inline-block">
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
          to={subjectsTo}
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
            to="/domains/$domainId/subjects/$subjectId/$categoryId/$topicId"
            params={{
              domainId: topic.domainId,
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
