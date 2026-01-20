import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"

export const Route = createFileRoute("/subjects/$subjectId/$categoryId/")({
  beforeLoad: requireAuth,
  component: CategoryPage,
})

function CategoryPage() {
  const { subjectId, categoryId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data: topics, isLoading } = useQuery({
    queryKey: ["subjects", subjectId, "categories", categoryId, "topics"],
    queryFn: async () => {
      const res = await api.api.subjects[":subjectId"].categories[
        ":categoryId"
      ].topics.$get({
        param: { subjectId, categoryId },
      })
      if (!res.ok) throw new Error("Failed to fetch topics")
      return res.json()
    },
  })

  // ユーザーの進捗情報を取得
  const { data: progressData } = useQuery({
    queryKey: ["progress", "me"],
    queryFn: async () => {
      const res = await api.api.subjects.progress.me.$get()
      if (!res.ok) throw new Error("Failed to fetch progress")
      return res.json()
    },
  })

  // 進捗をトピックIDでマップ化
  type Progress = {
    topicId: string
    understood: boolean
  }
  const progressMap = new Map<string, Progress>(
    progressData?.progress.map((p: Progress) => [p.topicId, p]) ?? []
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
      const res = await api.api.subjects[":subjectId"].topics[
        ":topicId"
      ].progress.$put({
        param: { subjectId, topicId },
        json: { understood },
      })
      if (!res.ok) throw new Error("Failed to update progress")
      return res.json()
    },
    onSuccess: () => {
      // 進捗とカテゴリを再取得
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
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <Link
          to="/subjects/$subjectId"
          params={{ subjectId }}
          className="text-blue-600 hover:underline text-sm"
        >
          ← カテゴリ一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">論点一覧</h1>
      </div>

      <div className="space-y-3">
        {topics?.topics.map((topic: { id: string; name: string; description: string | null }) => {
          const progress = progressMap.get(topic.id)
          const isUnderstood = progress?.understood ?? false

          return (
            <div
              key={topic.id}
              className={`card hover:shadow-md transition-shadow ${
                isUnderstood
                  ? "border-green-200 bg-green-50"
                  : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={(e) => handleToggleUnderstood(e, topic.id, isUnderstood)}
                  className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isUnderstood
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-300 hover:border-green-400"
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
                  to="/subjects/$subjectId/$categoryId/$topicId"
                  params={{ subjectId, categoryId, topicId: topic.id }}
                  className="flex-1 min-w-0"
                >
                  <h2
                    className={`font-medium ${
                      isUnderstood ? "text-green-800" : "text-gray-900"
                    }`}
                  >
                    {topic.name}
                  </h2>
                  {topic.description && (
                    <p
                      className={`text-sm mt-1 line-clamp-2 ${
                        isUnderstood ? "text-green-600" : "text-gray-600"
                      }`}
                    >
                      {topic.description}
                    </p>
                  )}
                </Link>
              </div>
            </div>
          )
        })}

        {topics?.topics.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            このカテゴリには論点がありません
          </p>
        )}
      </div>
    </div>
  )
}
