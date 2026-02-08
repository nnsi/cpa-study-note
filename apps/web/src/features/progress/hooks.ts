import { useQuery } from "@tanstack/react-query"
import * as api from "./api"
import * as logic from "./logic"

export const useProgress = () => {
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["progress", "me"],
    queryFn: api.getMyProgress,
  })

  const { data: subjectStatsData, isLoading: subjectStatsLoading } = useQuery({
    queryKey: ["progress", "subjects"],
    queryFn: api.getSubjectProgressStats,
  })

  const progress = progressData?.progress || []
  const subjectStats = subjectStatsData?.stats || []

  const { totalTopics, understoodTopics, recentlyAccessedTopics, completionRate } =
    logic.calculateProgressStats(progress, subjectStats)
  const subjectProgress = logic.mapSubjectProgress(subjectStats)

  return {
    isLoading: progressLoading || subjectStatsLoading,
    stats: {
      totalTopics,
      understoodTopics,
      recentlyAccessedTopics,
      completionRate,
    },
    subjectProgress,
  }
}
