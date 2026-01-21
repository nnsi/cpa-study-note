import { useProgress } from "../hooks"

export const ProgressStats = () => {
  const { isLoading, stats, subjectProgress } = useProgress()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
        <div className="h-32 skeleton rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* サマリー統計 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="総論点数"
          value={stats.totalTopics}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          }
          color="indigo"
        />
        <StatCard
          label="理解済み"
          value={stats.understoodTopics}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          color="jade"
        />
        <StatCard
          label="今週学習"
          value={stats.recentlyAccessedTopics}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          }
          color="amber"
        />
        <StatCard
          label="達成率"
          value={`${stats.completionRate}%`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
            </svg>
          }
          highlight
        />
      </div>

      {/* 進捗バー */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">全体の進捗</h3>
        <div className="progress-bar h-3">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.max(stats.completionRate, 2)}%` }}
          />
        </div>
        <p className="text-sm text-ink-600 mt-3">
          <span className="font-semibold text-ink-800">{stats.understoodTopics}</span>
          {" / "}
          <span className="text-ink-700">{stats.totalTopics}</span>
          {" 論点"}
        </p>
      </div>

      {/* 科目別進捗 */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-4">科目別進捗</h3>
        <div className="space-y-4">
          {subjectProgress.map((subject) => {
            const rate =
              subject.totalTopics > 0
                ? Math.round(
                    (subject.understoodTopics / subject.totalTopics) * 100
                  )
                : 0
            return (
              <div key={subject.id} className="group">
                <div className="flex justify-between items-center text-sm mb-1.5">
                  <span className="font-medium text-ink-800 group-hover:text-indigo-600 transition-colors">
                    {subject.name}
                  </span>
                  <span className="text-ink-600">
                    <span className="text-ink-800 font-medium">{subject.understoodTopics}</span>
                    /{subject.totalTopics}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(rate, 1)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type StatCardProps = {
  label: string
  value: number | string
  icon: React.ReactNode
  color?: "indigo" | "jade" | "amber"
  highlight?: boolean
}

const StatCard = ({ label, value, icon, color = "indigo", highlight }: StatCardProps) => {
  const colorClasses = {
    indigo: {
      bg: "bg-indigo-50",
      text: "text-indigo-500",
    },
    jade: {
      bg: "bg-jade-100",
      text: "text-jade-500",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-500",
    },
  }

  const colors = colorClasses[color]

  return (
    <div
      className={`card p-4 ${
        highlight
          ? "bg-gradient-to-br from-indigo-50 via-white to-jade-50 border-indigo-200/50"
          : ""
      }`}
    >
      <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
        <span className={colors.text}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-gradient" : "text-ink-900"}`}>
        {value}
      </p>
      <p className="text-xs text-ink-600 mt-0.5">{label}</p>
    </div>
  )
}
