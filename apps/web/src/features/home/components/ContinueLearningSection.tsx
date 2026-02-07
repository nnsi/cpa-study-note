import { Link } from "@tanstack/react-router"
import { useRecentTopics } from "../hooks"
import { useStudyDomains } from "@/features/study-domain"
import { formatRelativeTime } from "@/lib/date"

export const ContinueLearningSection = () => {
  const { topics, isLoading } = useRecentTopics()
  const { studyDomains } = useStudyDomains()

  // 学習領域が1つなら直接その科目一覧へ、複数または0なら領域選択へ
  const subjectsTo =
    studyDomains.length === 1
      ? `/domains/${studyDomains[0].id}/subjects`
      : "/domains"

  // Limit to 5 most recent topics
  const recentTopics = topics.slice(0, 5)

  if (isLoading) {
    return (
      <section className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h2 className="heading-serif text-lg">続きから学習</h2>
        </div>
        {/* Mobile: vertical stack */}
        <div className="flex flex-col gap-3 lg:hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-xl" />
          ))}
        </div>
        {/* PC: horizontal scroll */}
        <div className="hidden lg:flex gap-4 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-56 h-32 flex-shrink-0 skeleton rounded-xl" />
          ))}
        </div>
      </section>
    )
  }

  if (recentTopics.length === 0) {
    return (
      <section className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h2 className="heading-serif text-lg">続きから学習</h2>
        </div>
        <div className="text-center py-8 text-ink-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
          </svg>
          <p className="text-sm mb-2">まだ学習を始めていません</p>
          <p className="text-xs text-ink-400 mb-4">論点マップから学習を始めましょう</p>
          <Link
            to={subjectsTo}
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            論点マップを見る
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h2 className="heading-serif text-lg">続きから学習</h2>
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

      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-3 lg:hidden">
        {recentTopics.map((topic) => (
          <TopicCard key={topic.topicId} topic={topic} variant="mobile" />
        ))}
      </div>

      {/* PC: horizontal scroll */}
      <div className="hidden lg:flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {recentTopics.map((topic) => (
          <TopicCard key={topic.topicId} topic={topic} variant="desktop" />
        ))}
      </div>
    </section>
  )
}

type TopicCardProps = {
  topic: {
    topicId: string
    topicName: string
    domainId: string
    subjectId: string
    subjectName: string
    categoryId: string
    lastAccessedAt: string
  }
  variant: "mobile" | "desktop"
}

const TopicCard = ({ topic, variant }: TopicCardProps) => {
  const isMobile = variant === "mobile"

  return (
    <Link
      to="/domains/$domainId/subjects/$subjectId/$categoryId/$topicId"
      params={{
        domainId: topic.domainId,
        subjectId: topic.subjectId,
        categoryId: topic.categoryId,
        topicId: topic.topicId,
      }}
      className={`
        group block
        ${isMobile ? "w-full" : "w-56 flex-shrink-0"}
        bg-white rounded-xl border border-ink-100
        hover:border-indigo-200 hover:shadow-soft-lg hover:-translate-y-0.5
        transition-all duration-300 ease-out
        p-4
      `}
    >
      <div className="flex flex-col h-full">
        {/* Topic name */}
        <h3 className="font-medium text-ink-900 group-hover:text-indigo-700 transition-colors line-clamp-2 mb-1">
          {topic.topicName}
        </h3>

        {/* Subject name */}
        <p className="text-xs text-ink-500 mb-3">{topic.subjectName}</p>

        {/* Footer: time and button */}
        <div className={`mt-auto flex items-center ${isMobile ? "justify-between" : "flex-col gap-2 items-start"}`}>
          <span className="text-xs text-ink-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {formatRelativeTime(topic.lastAccessedAt)}
          </span>
          <span className="text-sm text-indigo-600 font-medium flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
            続ける
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}
