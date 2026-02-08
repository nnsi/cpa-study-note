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

export const calculateProgressStats = (
  progress: ProgressItem[],
  subjectStats: SubjectProgressStat[]
) => {
  const totalTopics = subjectStats.reduce((acc, s) => acc + s.totalTopics, 0)
  const understoodTopics = subjectStats.reduce((acc, s) => acc + s.understoodTopics, 0)
  const recentlyAccessedTopics = progress.filter((p) => {
    if (!p.lastAccessedAt) return false
    const lastAccess = new Date(p.lastAccessedAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return lastAccess > weekAgo
  }).length
  const completionRate =
    totalTopics > 0 ? Math.round((understoodTopics / totalTopics) * 100) : 0

  return { totalTopics, understoodTopics, recentlyAccessedTopics, completionRate }
}

export const mapSubjectProgress = (subjectStats: SubjectProgressStat[]) =>
  subjectStats.map((stat) => ({
    id: stat.subjectId,
    name: stat.subjectName,
    totalTopics: stat.totalTopics,
    understoodTopics: stat.understoodTopics,
  }))
