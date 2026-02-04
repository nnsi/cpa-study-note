import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"
import { filterTopics, type FilteredTopic } from "@/features/review/api"
import { getMyProgress } from "@/features/progress/api"
import { PageWrapper } from "@/components/layout"
import { BookmarkButton } from "@/features/bookmark"

// View API response type for category topics
type CategoryTopicsResponse = {
  category: {
    id: string
    name: string
  }
  topics: Array<{
    id: string
    name: string
    description: string | null
    displayOrder: number
  }>
}

export const Route = createFileRoute("/domains/$domainId/subjects/$subjectId/$categoryId/")({
  beforeLoad: requireAuth,
  component: CategoryPage,
})

function CategoryPage() {
  const { domainId, subjectId, categoryId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data: topicsData, isLoading } = useQuery({
    queryKey: ["subjects", subjectId, "categories", categoryId, "topics"],
    queryFn: async (): Promise<CategoryTopicsResponse> => {
      const res = await api.api.view.categories[":categoryId"].topics.$get({
        param: { categoryId },
      })
      if (!res.ok) throw new Error(`論点の取得に失敗しました (${res.status})`)
      return res.json() as Promise<CategoryTopicsResponse>
    },
  })

  // ユーザーの進捗情報を取得
  const { data: progressData } = useQuery({
    queryKey: ["progress", "me"],
    queryFn: getMyProgress,
  })

  // 論点の統計情報を取得（セッション数、深掘り質問数など）
  const { data: topicStatsData } = useQuery({
    queryKey: ["topics", "stats"],
    queryFn: () => filterTopics({}),
  })

  // 進捗をトピックIDでマップ化
  type Progress = {
    topicId: string
    understood: boolean
  }
  const progressMap = new Map<string, Progress>(
    progressData?.progress.map((p: Progress) => [p.topicId, p]) ?? []
  )

  // 論点統計をIDでマップ化
  const statsMap = new Map<string, FilteredTopic>(
    topicStatsData?.map((t) => [t.id, t]) ?? []
  )

  // 理解済み状態を更新
  const updateProgressMutation = useMutation({
    mutationFn: async ({
      topicId,
      understood,
    }: {
      topicId: string
      understood: boolean
    }) => {
      const res = await api.api.learning.topics[":topicId"].progress.$put({
        param: { topicId },
        json: { understood },
      })
      if (!res.ok) throw new Error(`進捗の更新に失敗しました (${res.status})`)
      return res.json()
    },
    onSuccess: () => {
      // 進捗と単元を再取得
      queryClient.invalidateQueries({ queryKey: ["progress", "me"] })
      queryClient.invalidateQueries({
        queryKey: ["subjects", subjectId, "categories"],
      })
    },
  })

  const handleToggleUnderstood = (
    e: React.MouseEvent,
    topicId: string,
    currentUnderstood: boolean
  ) => {
    e.preventDefault()
    e.stopPropagation()
    updateProgressMutation.mutate({ topicId, understood: !currentUnderstood })
  }

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="mb-6">
        <Link
          to="/domains/$domainId/subjects/$subjectId"
          params={{ domainId, subjectId }}
          className="text-indigo-600 hover:underline text-sm"
        >
          ← 単元一覧
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-bold text-ink-900">論点一覧</h1>
          <BookmarkButton targetType="category" targetId={categoryId} size="md" />
        </div>
      </div>

      <div className="space-y-3">
        {topicsData?.topics.map((topic: { id: string; name: string; description: string | null }) => {
          const progress = progressMap.get(topic.id)
          const isUnderstood = progress?.understood ?? false
          const stats = statsMap.get(topic.id)

          return (
            <div
              key={topic.id}
              className={`card p-4 hover:shadow-md transition-shadow ${
                isUnderstood
                  ? "border-jade-200 bg-jade-100/50"
                  : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => handleToggleUnderstood(e, topic.id, isUnderstood)}
                  className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isUnderstood
                      ? "bg-jade-500 border-jade-500 text-white"
                      : "border-ink-300 hover:border-jade-400"
                  }`}
                  title={isUnderstood ? "理解済みを解除" : "理解済みにする"}
                >
                  {isUnderstood && (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <Link
                  to="/domains/$domainId/subjects/$subjectId/$categoryId/$topicId"
                  params={{ domainId, subjectId, categoryId, topicId: topic.id }}
                  className="flex-1 min-w-0"
                >
                  <h2
                    className={`font-medium ${
                      isUnderstood ? "text-jade-700" : "text-ink-800"
                    }`}
                  >
                    {topic.name}
                  </h2>
                  {topic.description && (
                    <p
                      className={`text-sm mt-1 line-clamp-2 ${
                        isUnderstood ? "text-jade-600" : "text-ink-600"
                      }`}
                    >
                      {topic.description}
                    </p>
                  )}
                  {/* 学習状況インジケーター */}
                  {stats && (stats.sessionCount > 0 || stats.goodQuestionCount > 0) && (
                    <div className="flex items-center gap-3 mt-2">
                      {stats.sessionCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                          </svg>
                          {stats.sessionCount}回
                        </span>
                      )}
                      {stats.goodQuestionCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-jade-600">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          深掘り{stats.goodQuestionCount}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </div>
            </div>
          )
        })}

        {topicsData?.topics.length === 0 && (
          <p className="text-ink-500 text-center py-8">
            この単元には論点がありません
          </p>
        )}
      </div>
    </PageWrapper>
  )
}
