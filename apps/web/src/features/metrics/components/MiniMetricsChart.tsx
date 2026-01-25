import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { useDailyMetrics, type ChartDataPoint } from "../hooks"

type MiniTooltipProps = {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    dataKey: string
  }>
  label?: string
}

const MiniTooltip = ({ active, payload, label }: MiniTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null

  const labelMap: Record<string, string> = {
    checkedTopicCount: "チェック済み",
    sessionCount: "セッション",
  }

  return (
    <div className="bg-white border border-sand-200 rounded-lg shadow-lg p-2 text-xs">
      <p className="font-medium text-ink-800 mb-1">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-ink-600">
              {labelMap[entry.dataKey] || entry.name}:
            </span>
            <span className="font-medium text-ink-800">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type MiniChartProps = {
  data: ChartDataPoint[]
}

const MiniChart = ({ data }: MiniChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
      >
        <XAxis
          dataKey="displayDate"
          tick={{ fontSize: 10, fill: "#888" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e5e5" }}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#888" }}
          tickLine={false}
          axisLine={false}
          width={35}
        />
        <Tooltip content={<MiniTooltip />} />
        <Line
          type="monotone"
          dataKey="checkedTopicCount"
          name="checkedTopicCount"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 2, fill: "#6366f1" }}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="sessionCount"
          name="sessionCount"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 2, fill: "#10b981" }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

const LoadingSkeleton = () => (
  <div className="h-[120px] skeleton rounded-lg" />
)

const EmptyState = () => (
  <div className="h-[120px] flex items-center justify-center">
    <p className="text-xs text-ink-400">学習データがありません</p>
  </div>
)

export const MiniMetricsChart = () => {
  // 常に7日固定
  const { chartData, isLoading } = useDailyMetrics("7days")

  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-700">学習推移</h3>
          <div className="h-4 w-12 skeleton rounded" />
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  const hasData = chartData.some(
    (d) => d.checkedTopicCount > 0 || d.sessionCount > 0
  )

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-700">学習推移</h3>
        <span className="text-xs text-ink-400">直近7日</span>
      </div>
      {/* 凡例（インラインで表示） */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-xs text-ink-500">チェック済み</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-ink-500">セッション</span>
        </div>
      </div>
      {hasData ? <MiniChart data={chartData} /> : <EmptyState />}
    </div>
  )
}
