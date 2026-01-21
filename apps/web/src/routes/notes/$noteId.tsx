import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"

export const Route = createFileRoute("/notes/$noteId")({
  beforeLoad: requireAuth,
  component: NoteDetailPage,
})

function NoteDetailPage() {
  const { noteId } = Route.useParams()
  const queryClient = useQueryClient()
  const [userMemo, setUserMemo] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["notes", noteId],
    queryFn: async () => {
      const res = await api.api.notes[":noteId"].$get({
        param: { noteId },
      })
      if (!res.ok) throw new Error(`ノートの取得に失敗しました (${res.status})`)
      return res.json()
    },
  })

  // データ取得時にメモを初期化
  useEffect(() => {
    if (data?.note) {
      setUserMemo(data.note.userMemo || "")
    }
  }, [data])

  const { mutate: updateNote, isPending } = useMutation({
    mutationFn: async () => {
      const res = await api.api.notes[":noteId"].$put({
        param: { noteId },
        json: { userMemo },
      })
      if (!res.ok) throw new Error(`ノートの更新に失敗しました (${res.status})`)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", noteId] })
      setIsEditing(false)
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 skeleton rounded w-1/3" />
          <div className="h-32 skeleton rounded" />
        </div>
      </div>
    )
  }

  const note = data?.note

  if (!note) {
    return (
      <div className="p-4 lg:p-6">
        <div className="text-crimson-500">ノートが見つかりません</div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 text-sm">
        <Link to="/notes" className="text-indigo-600 hover:underline">
          ← ノート一覧
        </Link>
        {note.subjectId && note.categoryId && note.topicId && (
          <>
            <span className="text-ink-300">|</span>
            <Link
              to="/subjects/$subjectId/$categoryId/$topicId"
              params={{
                subjectId: note.subjectId,
                categoryId: note.categoryId,
                topicId: note.topicId,
              }}
              className="text-indigo-600 hover:underline"
            >
              ← {note.topicName || "論点"}に戻る
            </Link>
          </>
        )}
      </div>

      <div className="mt-4 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-ink-600 mb-2">AI要約</h2>
          <div className="card p-4">
            <p className="text-ink-800 whitespace-pre-wrap">{note.aiSummary}</p>
          </div>
        </section>

        {note.keyPoints.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-ink-600 mb-2">
              重要ポイント
            </h2>
            <ul className="space-y-2">
              {note.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-indigo-600">•</span>
                  <span className="text-ink-800">{point}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {note.stumbledPoints.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-ink-600 mb-2">
              つまずきポイント
            </h2>
            <ul className="space-y-2">
              {note.stumbledPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-500">!</span>
                  <span className="text-ink-800">{point}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-ink-600">自分のメモ</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-indigo-600 hover:underline"
              >
                編集
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={userMemo}
                onChange={(e) => setUserMemo(e.target.value)}
                className="input-field min-h-[120px]"
                placeholder="メモを入力..."
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setUserMemo(note.userMemo || "")
                    setIsEditing(false)
                  }}
                  className="btn-secondary text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => updateNote()}
                  disabled={isPending}
                  className="btn-primary text-sm"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-4">
              {note.userMemo ? (
                <p className="text-ink-800 whitespace-pre-wrap">
                  {note.userMemo}
                </p>
              ) : (
                <p className="text-ink-500 italic">メモはありません</p>
              )}
            </div>
          )}
        </section>

        <div className="text-sm text-ink-500 pt-4 border-t border-ink-100">
          作成日: {new Date(note.createdAt).toLocaleString("ja-JP")}
        </div>
      </div>
    </div>
  )
}
