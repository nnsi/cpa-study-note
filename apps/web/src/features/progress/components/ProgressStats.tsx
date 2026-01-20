import { useProgress } from "../hooks"

export const ProgressStats = () => {
  const { isLoading, stats, subjectProgress } = useProgress()

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
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
          icon="📚"
        />
        <StatCard
          label="理解済み"
          value={stats.understoodTopics}
          icon="✅"
          subtext={`${stats.completionRate}%`}
        />
        <StatCard
          label="今週学習"
          value={stats.recentlyAccessedTopics}
          icon="📆"
        />
        <StatCard
          label="達成率"
          value={`${stats.completionRate}%`}
          icon="🎯"
          highlight
        />
      </div>

      {/* 進捗バー */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">全体の進捗</h3>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${stats.completionRate}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {stats.understoodTopics} / {stats.totalTopics} 論点
        </p>
      </div>

      {/* 科目別進捗 */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-4">科目別進捗</h3>
        <div className="space-y-3">
          {subjectProgress.map((subject) => {
            const rate =
              subject.totalTopics > 0
                ? Math.round(
                    (subject.understoodTopics / subject.totalTopics) * 100
                  )
                : 0
            return (
              <div key={subject.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{subject.name}</span>
                  <span className="text-gray-500">
                    {subject.understoodTopics}/{subject.totalTopics}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${rate}%` }}
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
  icon: string
  subtext?: string
  highlight?: boolean
}

const StatCard = ({ label, value, icon, subtext, highlight }: StatCardProps) => (
  <div
    className={`card ${
      highlight ? "bg-gradient-to-br from-blue-50 to-green-50 border-blue-200" : ""
    }`}
  >
    <div className="flex items-start justify-between">
      <span className="text-2xl">{icon}</span>
      {subtext && (
        <span className="text-xs text-green-600 font-medium">{subtext}</span>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
)
