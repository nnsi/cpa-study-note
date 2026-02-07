import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useCheckHistory } from "../hooks"
import type { CheckHistoryItem } from "../api"
import { BookmarkButton } from "@/features/bookmark"
import { formatRelativeTime } from "@/lib/date"

type Topic = {
  id: string
  categoryId: string
  name: string
  description: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
}

type Progress = {
  userId: string
  topicId: string
  understood: boolean
  lastAccessedAt: string | null
  createdAt: string
  updatedAt: string
}

type Session = {
  id: string
  messageCount: number
  goodCount: number
  surfaceCount: number
}

type Props = {
  topic: Topic
  progress: Progress | null
  subjectId: string
  sessions?: Session[]
}

export const TopicInfo = ({ topic, progress, subjectId, sessions = [] }: Props) => {
  const queryClient = useQueryClient()

  const { mutate: updateProgress, isPending } = useMutation({
    mutationFn: async (understood: boolean) => {
      const res = await api.api.learning.topics[":topicId"].progress.$put({
        param: { topicId: topic.id },
        json: { understood },
      })
      if (!res.ok) throw new Error("Failed to update progress")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", topic.id] })
      queryClient.invalidateQueries({ queryKey: ["progress", "me"] })
      queryClient.invalidateQueries({ queryKey: ["check-history", topic.id] })
    },
  })

  // チェック履歴を取得
  const { data: historyData, isLoading: isLoadingHistory } = useCheckHistory(
    subjectId,
    topic.id
  )

  const isUnderstood = progress?.understood ?? false

  return (
    <div className="p-4 space-y-6">
      {/* ブックマークボタン */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-500">この論点をブックマーク</span>
        <BookmarkButton targetType="topic" targetId={topic.id} size="md" />
      </div>

      {topic.description && (
        <p className="text-sm text-ink-600">{topic.description}</p>
      )}

      <div>
        <button
          onClick={() => updateProgress(!isUnderstood)}
          disabled={isPending}
          className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
            isUnderstood
              ? "bg-jade-100 text-jade-700 hover:bg-jade-200"
              : "bg-ink-100 text-ink-700 hover:bg-ink-200"
          }`}
        >
          {isUnderstood ? "✓ 理解済み" : "□ 理解済みとしてマーク"}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-700">学習統計</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-ink-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-ink-900">
              {progress?.lastAccessedAt
                ? formatRelativeTime(progress.lastAccessedAt)
                : "-"}
            </p>
            <p className="text-xs text-ink-500">最終アクセス</p>
          </div>
          <div className="bg-ink-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-ink-900">
              {sessions.length}
            </p>
            <p className="text-xs text-ink-500">チャット回数</p>
          </div>
          {sessions.length > 0 && (
            <>
              <div className="bg-ink-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-ink-900">
                  {sessions.reduce((sum, s) => sum + s.messageCount, 0)}
                </p>
                <p className="text-xs text-ink-500">総メッセージ</p>
              </div>
              <div className="bg-ink-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-jade-600">
                  {sessions.reduce((sum, s) => sum + s.goodCount, 0)}
                </p>
                <p className="text-xs text-ink-500">深掘り質問</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* チェック履歴タイムライン */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-700">チェック履歴</h3>
        {isLoadingHistory ? (
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 skeleton rounded" />
            ))}
          </div>
        ) : (
          <CheckHistoryTimeline history={historyData?.history ?? []} />
        )}
      </div>
    </div>
  )
}

// チェック履歴タイムラインコンポーネント
const CheckHistoryTimeline = ({ history }: { history: CheckHistoryItem[] }) => {
  if (history.length === 0) {
    return (
      <p className="text-sm text-ink-500 text-center py-2">
        まだチェック履歴がありません
      </p>
    )
  }

  return (
    <div className="relative">
      {/* タイムラインの縦線 */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-ink-200" />

      <div className="space-y-3">
        {history.map((item) => {
          const isChecked = item.action === "checked"
          const date = new Date(item.checkedAt)

          return (
            <div key={item.id} className="relative flex items-start gap-3 pl-1">
              {/* ドットインジケーター */}
              <div
                className={`relative z-10 flex-shrink-0 size-5 rounded-full flex items-center justify-center ${
                  isChecked
                    ? "bg-jade-100 text-jade-600"
                    : "bg-ink-100 text-ink-500"
                }`}
              >
                {isChecked ? (
                  <svg
                    className="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  <svg
                    className="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </div>

              {/* 内容 */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-sm font-medium ${
                  isChecked ? "text-jade-700" : "text-ink-600"
                }`}>
                  {isChecked ? "理解済みにチェック" : "チェックを外す"}
                </p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {date.toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
