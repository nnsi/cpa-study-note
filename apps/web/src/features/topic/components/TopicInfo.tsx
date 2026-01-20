import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

type Topic = {
  id: string
  categoryId: string
  name: string
  description: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
  progress: {
    userId: string
    topicId: string
    understood: boolean
    lastAccessedAt: string | null
    createdAt: string
    updatedAt: string
  } | null
}

type Props = {
  topic: Topic
  subjectId: string
}

export const TopicInfo = ({ topic, subjectId }: Props) => {
  const queryClient = useQueryClient()

  const { mutate: updateProgress, isPending } = useMutation({
    mutationFn: async (understood: boolean) => {
      const res = await api.api.subjects[":subjectId"].topics[
        ":topicId"
      ].progress.$put({
        param: { subjectId, topicId: topic.id },
        json: { understood },
      })
      if (!res.ok) throw new Error("Failed to update progress")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", topic.id] })
      queryClient.invalidateQueries({ queryKey: ["progress", "me"] })
    },
  })

  const isUnderstood = topic.progress?.understood ?? false

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{topic.name}</h2>
        {topic.description && (
          <p className="mt-2 text-sm text-gray-600">{topic.description}</p>
        )}
      </div>

      <div>
        <button
          onClick={() => updateProgress(!isUnderstood)}
          disabled={isPending}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            isUnderstood
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {isUnderstood ? "✓ 理解済み" : "□ 理解済みとしてマーク"}
        </button>
      </div>

      {topic.progress && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">学習統計</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">
                {topic.progress.lastAccessedAt
                  ? formatRelativeTime(topic.progress.lastAccessedAt)
                  : "-"}
              </p>
              <p className="text-xs text-gray-500">最終アクセス</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 1000 / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return "たった今"
  if (diffMinutes < 60) return `${diffMinutes}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 7) return `${diffDays}日前`
  return date.toLocaleDateString("ja-JP")
}
