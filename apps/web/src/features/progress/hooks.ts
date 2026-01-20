import { useQuery } from "@tanstack/react-query"
import * as api from "./api"

export const useProgress = () => {
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["progress", "me"],
    queryFn: api.getMyProgress,
  })

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: api.getSubjects,
  })

  const progress = progressData?.progress || []
  const subjects = subjectsData?.subjects || []

  // 統計計算
  const totalTopics = subjects.reduce((acc, s) => acc + s.topicCount, 0)
  const understoodTopics = progress.filter((p) => p.understood).length
  const recentlyAccessedTopics = progress.filter((p) => {
    if (!p.lastAccessedAt) return false
    const lastAccess = new Date(p.lastAccessedAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return lastAccess > weekAgo
  }).length

  // 科目別の進捗
  const subjectProgress = subjects.map((subject) => {
    const subjectTopicProgress = progress.filter(
      (p) =>
        // topicIdから科目を推定する方法が必要
        // 一旦、全体の進捗から計算
        true
    )
    return {
      id: subject.id,
      name: subject.name,
      totalTopics: subject.topicCount,
      understoodTopics: Math.floor(
        (understoodTopics / Math.max(totalTopics, 1)) * subject.topicCount
      ),
    }
  })

  return {
    isLoading: progressLoading || subjectsLoading,
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
