import { useQuery } from "@tanstack/react-query"
import * as api from "./api"

type ProgressItem = {
  understood: boolean
  lastAccessedAt: string | null
}

type SubjectProgressStat = {
  subjectId: string
  subjectName: string
  totalTopics: number
  understoodTopics: number
}

export const useProgress = () => {
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["progress", "me"],
    queryFn: api.getMyProgress,
  })

  const { data: subjectStatsData, isLoading: subjectStatsLoading } = useQuery({
    queryKey: ["progress", "subjects"],
    queryFn: api.getSubjectProgressStats,
  })

  const progress: ProgressItem[] = progressData?.progress || []
  const subjectStats: SubjectProgressStat[] = subjectStatsData?.stats || []

  // 統計計算
  const totalTopics = subjectStats.reduce((acc, s) => acc + s.totalTopics, 0)
  const understoodTopics = subjectStats.reduce(
    (acc, s) => acc + s.understoodTopics,
    0
  )
  const recentlyAccessedTopics = progress.filter((p) => {
    if (!p.lastAccessedAt) return false
    const lastAccess = new Date(p.lastAccessedAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return lastAccess > weekAgo
  }).length

  // 科目別の進捗
  const subjectProgress = subjectStats.map((stat) => ({
    id: stat.subjectId,
    name: stat.subjectName,
    totalTopics: stat.totalTopics,
    understoodTopics: stat.understoodTopics,
  }))

  return {
    isLoading: progressLoading || subjectStatsLoading,
    stats: {
      totalTopics,
      understoodTopics,
      recentlyAccessedTopics,
      completionRate:
        totalTopics > 0
          ? Math.round((understoodTopics / totalTopics) * 100)
          : 0,
    },
    subjectProgress,
  }
}
