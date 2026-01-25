import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useNotesByTopic, useRefreshNote } from "../hooks"
import { api } from "@/lib/api-client"

type Note = {
  id: string
  sessionId: string | null
  aiSummary: string | null
  userMemo: string | null
  keyPoints: string[]
  stumbledPoints: string[]
  createdAt: string
}

type ChatMessage = {
  id: string
  sessionId: string
  role: string
  content: string
  questionQuality: "good" | "surface" | null
  createdAt: string
}

// 深掘り質問を取得するカスタムフック
const useGoodQuestionsByTopic = (sessionIds: string[]) => {
  return useQuery({
    queryKey: ["good-questions", ...sessionIds],
    queryFn: async () => {
      if (sessionIds.length === 0) return []

      // 各セッションのメッセージを取得
      const messagePromises = sessionIds.map(async (sessionId) => {
        try {
          const res = await api.api.chat.sessions[":sessionId"].messages.$get({
            param: { sessionId },
          })
          if (!res.ok) return []
          const data = await res.json()
          return data.messages as ChatMessage[]
        } catch {
          return []
        }
      })

      const allMessages = await Promise.all(messagePromises)

      // 深掘り質問のみをフィルタ
      return allMessages
        .flat()
        .filter((msg) => msg.role === "user" && msg.questionQuality === "good")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
    },
    enabled: sessionIds.length > 0,
  })
}

type Props = {
  topicId: string
}

export const TopicNotes = ({ topicId }: Props) => {
  const { data, isLoading, error } = useNotesByTopic(topicId)
  const { mutate: refreshNote, isPending: isRefreshing } = useRefreshNote(topicId)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [refreshingNoteId, setRefreshingNoteId] = useState<string | null>(null)
  const [showDeepDiveQuestions, setShowDeepDiveQuestions] = useState(false)

  const notes: Note[] = data?.notes || []

  // セッションIDを収集（深掘り質問取得用）
  const sessionIds = notes
    .map((note) => note.sessionId)
    .filter((id): id is string => id !== null)

  const { data: goodQuestions, isLoading: isLoadingQuestions } =
    useGoodQuestionsByTopic(sessionIds)

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-crimson-500">
        ノートの取得に失敗しました
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-ink-500">
        <p className="mb-2">この論点のノートはまだありません</p>
        <p className="text-sm">
          チャットで学習した後、ノートを作成できます
        </p>
      </div>
    )
  }

  const toggleNote = (noteId: string) => {
    setExpandedNoteId(expandedNoteId === noteId ? null : noteId)
  }

  return (
    <div className="p-4 space-y-4">
      {/* 深掘り質問セクション */}
      {(goodQuestions?.length ?? 0) > 0 && (
        <div className="bg-jade-50 border border-jade-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDeepDiveQuestions(!showDeepDiveQuestions)}
            className="w-full p-3 text-left hover:bg-jade-100/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-6 bg-jade-100 rounded-full">
                  <svg
                    className="size-3.5 text-jade-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                </span>
                <span className="text-sm font-semibold text-jade-800">
                  深掘りした質問
                </span>
                <span className="px-1.5 py-0.5 bg-jade-200 text-jade-700 text-xs font-medium rounded-full">
                  {goodQuestions?.length ?? 0}件
                </span>
              </div>
              <span className="text-jade-500">
                {showDeepDiveQuestions ? "▲" : "▼"}
              </span>
            </div>
          </button>

          {showDeepDiveQuestions && (
            <div className="px-3 pb-3 border-t border-jade-200">
              {isLoadingQuestions ? (
                <div className="animate-pulse space-y-2 pt-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-12 skeleton rounded" />
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-jade-100">
                  {goodQuestions?.map((question) => (
                    <li key={question.id} className="py-2.5 first:pt-3">
                      <p className="text-sm text-jade-900 line-clamp-3">
                        {question.content}
                      </p>
                      <p className="text-xs text-jade-600 mt-1">
                        {new Date(question.createdAt).toLocaleDateString(
                          "ja-JP",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ノート一覧 */}
      <div className="space-y-3">
      {notes.map((note) => {
        const isExpanded = expandedNoteId === note.id

        return (
          <div
            key={note.id}
            className="bg-white border border-ink-100 rounded-xl overflow-hidden"
          >
            {/* ヘッダー（クリックで展開） */}
            <button
              onClick={() => toggleNote(note.id)}
              className="w-full p-4 text-left hover:bg-ink-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-ink-800 text-sm ${isExpanded ? "" : "line-clamp-2"}`}>
                  {note.aiSummary}
                </p>
                <span className="text-ink-400 flex-shrink-0">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-ink-500">
                <span>
                  {new Date(note.createdAt).toLocaleDateString("ja-JP")}
                </span>
                {note.keyPoints.length > 0 && (
                  <span>{note.keyPoints.length} ポイント</span>
                )}
              </div>
            </button>

            {/* 展開コンテンツ */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-ink-100 bg-ink-50">
                {/* キーポイント */}
                {note.keyPoints.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-ink-600 mb-1">
                      キーポイント
                    </h4>
                    <ul className="space-y-1">
                      {note.keyPoints.map((point, i) => (
                        <li
                          key={i}
                          className="text-sm text-ink-700 flex items-start gap-1"
                        >
                          <span className="text-jade-500">✓</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* つまずきポイント */}
                {note.stumbledPoints.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-ink-600 mb-1">
                      つまずきポイント
                    </h4>
                    <ul className="space-y-1">
                      {note.stumbledPoints.map((point, i) => (
                        <li
                          key={i}
                          className="text-sm text-ink-700 flex items-start gap-1"
                        >
                          <span className="text-amber-500">!</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ユーザーメモ */}
                {note.userMemo && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-ink-600 mb-1">
                      メモ
                    </h4>
                    <p className="text-sm text-ink-700 whitespace-pre-wrap">
                      {note.userMemo}
                    </p>
                  </div>
                )}

                {/* アクションボタン */}
                <div className="mt-3 pt-2 border-t border-ink-200 flex items-center justify-between">
                  <Link
                    to="/notes/$noteId"
                    params={{ noteId: note.id }}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    編集・詳細を見る →
                  </Link>
                  {note.sessionId && (
                    <button
                      onClick={() => {
                        setRefreshingNoteId(note.id)
                        refreshNote(note.id, {
                          onSettled: () => setRefreshingNoteId(null),
                        })
                      }}
                      disabled={isRefreshing && refreshingNoteId === note.id}
                      className="text-sm text-ink-500 hover:text-ink-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      {isRefreshing && refreshingNoteId === note.id ? (
                        <>
                          <svg className="animate-spin size-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          更新中...
                        </>
                      ) : (
                        <>
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          最新の会話を反映
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
