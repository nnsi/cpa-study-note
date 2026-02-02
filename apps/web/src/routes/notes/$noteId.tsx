import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { noteSingleResponseSchema, type NoteDetailResponse } from "@cpa-study/shared/schemas"

export const Route = createFileRoute("/notes/$noteId")({
  beforeLoad: requireAuth,
  component: NoteDetailPage,
})

function NoteDetailPage() {
  const { noteId } = Route.useParams()
  const queryClient = useQueryClient()
  const [userMemo, setUserMemo] = useState("")
  const [keyPoints, setKeyPoints] = useState<string[]>([])
  const [stumbledPoints, setStumbledPoints] = useState<string[]>([])
  const [isEditingMemo, setIsEditingMemo] = useState(false)
  const [isEditingKeyPoints, setIsEditingKeyPoints] = useState(false)
  const [isEditingStumbledPoints, setIsEditingStumbledPoints] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["notes", noteId],
    queryFn: async (): Promise<{ note: NoteDetailResponse }> => {
      const res = await api.api.notes[":noteId"].$get({
        param: { noteId },
      })
      if (!res.ok) throw new Error(`ノートの取得に失敗しました (${res.status})`)
      const json = await res.json()
      return noteSingleResponseSchema.parse(json)
    },
  })

  // データ取得時に状態を初期化
  useEffect(() => {
    if (data?.note) {
      setUserMemo(data.note.userMemo || "")
      setKeyPoints(data.note.keyPoints || [])
      setStumbledPoints(data.note.stumbledPoints || [])
    }
  }, [data])

  const { mutate: updateNote, isPending } = useMutation({
    mutationFn: async (updates: { userMemo?: string; keyPoints?: string[]; stumbledPoints?: string[] }) => {
      const res = await api.api.notes[":noteId"].$put({
        param: { noteId },
        json: updates,
      })
      if (!res.ok) throw new Error(`ノートの更新に失敗しました (${res.status})`)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", noteId] })
      setIsEditingMemo(false)
      setIsEditingKeyPoints(false)
      setIsEditingStumbledPoints(false)
    },
  })

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="animate-pulse space-y-4">
          <div className="h-8 skeleton rounded w-1/3" />
          <div className="h-32 skeleton rounded" />
        </div>
      </PageWrapper>
    )
  }

  const note = data?.note

  if (!note) {
    return (
      <PageWrapper>
        <div className="text-crimson-500">ノートが見つかりません</div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
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

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-ink-600">重要ポイント</h2>
            {!isEditingKeyPoints && (
              <button
                onClick={() => setIsEditingKeyPoints(true)}
                className="text-sm text-indigo-600 hover:underline"
              >
                編集
              </button>
            )}
          </div>

          {isEditingKeyPoints ? (
            <div className="space-y-2">
              {keyPoints.map((point, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => {
                      const newPoints = [...keyPoints]
                      newPoints[i] = e.target.value
                      setKeyPoints(newPoints)
                    }}
                    className="input-field flex-1"
                    placeholder="重要ポイント"
                  />
                  <button
                    onClick={() => setKeyPoints(keyPoints.filter((_, idx) => idx !== i))}
                    className="text-crimson-500 hover:text-crimson-600 px-2"
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => setKeyPoints([...keyPoints, ""])}
                className="text-sm text-indigo-600 hover:underline"
                type="button"
              >
                + 追加
              </button>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setKeyPoints(note.keyPoints || [])
                    setIsEditingKeyPoints(false)
                  }}
                  className="btn-secondary text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => updateNote({ keyPoints: keyPoints.filter((p) => p.trim()) })}
                  disabled={isPending}
                  className="btn-primary text-sm"
                >
                  保存
                </button>
              </div>
            </div>
          ) : keyPoints.length > 0 ? (
            <ul className="space-y-2">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-indigo-600">•</span>
                  <span className="text-ink-800">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 italic">重要ポイントはありません</p>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-ink-600">つまずきポイント</h2>
            {!isEditingStumbledPoints && (
              <button
                onClick={() => setIsEditingStumbledPoints(true)}
                className="text-sm text-indigo-600 hover:underline"
              >
                編集
              </button>
            )}
          </div>

          {isEditingStumbledPoints ? (
            <div className="space-y-2">
              {stumbledPoints.map((point, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => {
                      const newPoints = [...stumbledPoints]
                      newPoints[i] = e.target.value
                      setStumbledPoints(newPoints)
                    }}
                    className="input-field flex-1"
                    placeholder="つまずきポイント"
                  />
                  <button
                    onClick={() => setStumbledPoints(stumbledPoints.filter((_, idx) => idx !== i))}
                    className="text-crimson-500 hover:text-crimson-600 px-2"
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => setStumbledPoints([...stumbledPoints, ""])}
                className="text-sm text-indigo-600 hover:underline"
                type="button"
              >
                + 追加
              </button>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setStumbledPoints(note.stumbledPoints || [])
                    setIsEditingStumbledPoints(false)
                  }}
                  className="btn-secondary text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => updateNote({ stumbledPoints: stumbledPoints.filter((p) => p.trim()) })}
                  disabled={isPending}
                  className="btn-primary text-sm"
                >
                  保存
                </button>
              </div>
            </div>
          ) : stumbledPoints.length > 0 ? (
            <ul className="space-y-2">
              {stumbledPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-500">!</span>
                  <span className="text-ink-800">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 italic">つまずきポイントはありません</p>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-ink-600">自分のメモ</h2>
            {!isEditingMemo && (
              <button
                onClick={() => setIsEditingMemo(true)}
                className="text-sm text-indigo-600 hover:underline"
              >
                編集
              </button>
            )}
          </div>

          {isEditingMemo ? (
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
                    setIsEditingMemo(false)
                  }}
                  className="btn-secondary text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => updateNote({ userMemo })}
                  disabled={isPending}
                  className="btn-primary text-sm"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-4">
              {userMemo ? (
                <p className="text-ink-800 whitespace-pre-wrap">
                  {userMemo}
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
    </PageWrapper>
  )
}
