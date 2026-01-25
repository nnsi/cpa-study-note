import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import * as api from "./api"
import {
  type DateRange,
  type ChartDataPoint,
  getDateRangeParams,
  transformToChartData,
  getRangeLabel,
} from "./logic"

export type { DateRange, ChartDataPoint }

export const useDailyMetrics = (initialRange: DateRange = "7days") => {
  const [range, setRange] = useState<DateRange>(initialRange)
  const { from, to } = useMemo(() => getDateRangeParams(range), [range])

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["metrics", "daily", from, to],
    queryFn: () => api.getDailyMetrics(from, to),
  })

  const chartData = useMemo(() => {
    if (!data?.metrics) return []
    return transformToChartData(data.metrics, from, to)
  }, [data?.metrics, from, to])

  const rangeLabel = getRangeLabel(range)

  return {
    chartData,
    isLoading,
    error,
    range,
    rangeLabel,
    setRange,
    refetch,
  }
}
