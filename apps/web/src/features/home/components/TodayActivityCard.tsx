import { useTodayMetrics } from "../hooks"

export const TodayActivityCard = () => {
  const { metrics, isLoading } = useTodayMetrics()

  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="heading-serif text-lg">今日の活動</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const items = [
    {
      label: "チャット",
      value: metrics?.sessionCount ?? 0,
      unit: "回",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
      ),
      color: "indigo",
    },
    {
      label: "メッセージ",
      value: metrics?.messageCount ?? 0,
      unit: "件",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      ),
      color: "jade",
    },
    {
      label: "チェック",
      value: metrics?.checkedTopicCount ?? 0,
      unit: "論点",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      color: "amber",
    },
  ]

  const colorClasses = {
    indigo: {
      bg: "bg-indigo-50",
      text: "text-indigo-600",
    },
    jade: {
      bg: "bg-jade-100",
      text: "text-jade-600",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-600",
    },
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
        </div>
        <h3 className="heading-serif text-lg">今日の活動</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => {
          const colors = colorClasses[item.color as keyof typeof colorClasses]
          return (
            <div key={item.label} className="text-center">
              <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center mx-auto mb-2`}>
                <span className={colors.text}>{item.icon}</span>
              </div>
              <p className="text-2xl font-bold text-ink-900">
                {item.value}
                <span className="text-sm font-normal text-ink-500 ml-0.5">{item.unit}</span>
              </p>
              <p className="text-xs text-ink-500 mt-0.5">{item.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
