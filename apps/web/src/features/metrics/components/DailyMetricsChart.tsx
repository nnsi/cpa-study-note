import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { useDailyMetrics, type DateRange, type ChartDataPoint } from "../hooks"

type RangeSelectorProps = {
  value: DateRange
  onChange: (range: DateRange) => void
}

const RangeSelector = ({ value, onChange }: RangeSelectorProps) => {
  const options: { value: DateRange; label: string }[] = [
    { value: "7days", label: "7日" },
    { value: "30days", label: "30日" },
    { value: "90days", label: "90日" },
  ]

  return (
    <div className="flex gap-1 p-1 bg-sand-100 rounded-lg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
            value === option.value
              ? "bg-white text-ink-900 shadow-sm"
              : "text-ink-600 hover:text-ink-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

type CustomTooltipProps = {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    dataKey: string
  }>
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null

  const labelMap: Record<string, string> = {
    checkedTopicCount: "チェック済み論点",
    sessionCount: "セッション数",
    messageCount: "メッセージ数",
    goodQuestionCount: "深掘り質問数",
  }

  return (
    <div className="bg-white border border-sand-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-ink-800 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
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

type ChartProps = {
  data: ChartDataPoint[]
  range: DateRange
}

const Chart = ({ data, range }: ChartProps) => {
  // 期間に応じてX軸のtick間隔を調整
  const tickInterval = range === "7days" ? 0 : range === "30days" ? 4 : 13

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis
          dataKey="displayDate"
          tick={{ fontSize: 12, fill: "#666" }}
          tickLine={{ stroke: "#ccc" }}
          interval={tickInterval}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12, fill: "#666" }}
          tickLine={{ stroke: "#ccc" }}
          width={40}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12, fill: "#666" }}
          tickLine={{ stroke: "#ccc" }}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: 16 }}
          formatter={(value) => {
            const labelMap: Record<string, string> = {
              checkedTopicCount: "チェック済み論点",
              sessionCount: "セッション数",
              messageCount: "メッセージ数",
              goodQuestionCount: "深掘り質問数",
            }
            return (
              <span className="text-sm text-ink-700">
                {labelMap[value] || value}
              </span>
            )
          }}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="checkedTopicCount"
          name="checkedTopicCount"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3, fill: "#6366f1" }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="sessionCount"
          name="sessionCount"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3, fill: "#10b981" }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="messageCount"
          name="messageCount"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3, fill: "#f59e0b" }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="goodQuestionCount"
          name="goodQuestionCount"
          stroke="#ec4899"
          strokeWidth={2}
          dot={{ r: 3, fill: "#ec4899" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <div className="h-6 w-32 skeleton rounded" />
      <div className="h-9 w-36 skeleton rounded-lg" />
    </div>
    <div className="h-[300px] skeleton rounded-lg" />
  </div>
)

const EmptyState = () => (
  <div className="h-[300px] flex items-center justify-center">
    <div className="text-center">
      <svg
        className="w-12 h-12 mx-auto text-ink-300 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
      <p className="text-sm text-ink-500">データがありません</p>
      <p className="text-xs text-ink-400 mt-1">
        学習を始めるとグラフが表示されます
      </p>
    </div>
  </div>
)

export const DailyMetricsChart = () => {
  const { chartData, isLoading, range, rangeLabel, setRange } =
    useDailyMetrics()

  if (isLoading) {
    return (
      <div className="card p-5">
        <LoadingSkeleton />
      </div>
    )
  }

  const hasData = chartData.some(
    (d) => d.checkedTopicCount > 0 || d.sessionCount > 0 || d.messageCount > 0 || d.goodQuestionCount > 0
  )

  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <h3 className="text-sm font-semibold text-ink-700">
          学習推移（{rangeLabel}）
        </h3>
        <RangeSelector value={range} onChange={setRange} />
      </div>
      {hasData ? <Chart data={chartData} range={range} /> : <EmptyState />}
    </div>
  )
}
