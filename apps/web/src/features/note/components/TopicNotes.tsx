import { useState, useCallback } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useNotesByTopic, useRefreshNote, useCreateManualNote, useDeleteNote } from "../hooks"
import { api } from "@/lib/api-client"
import type { Note, NoteSource, GoodQuestionResponse } from "@cpa-study/shared/schemas"
import { goodQuestionsListResponseSchema } from "@cpa-study/shared/schemas"

// APIレスポンスのNote型（sourceはオプショナルで追加される場合がある）
type NoteWithOptionalSource = Note & { source?: NoteSource }

// Re-export for local use
type GoodQuestion = GoodQuestionResponse

// 深掘り質問を取得するカスタムフック（バッチ取得でN+1解消）
const useGoodQuestionsByTopic = (topicId: string) => {
  return useQuery({
    queryKey: ["good-questions", topicId],
    queryFn: async () => {
      const res = await api.api.chat.topics[":topicId"]["good-questions"].$get({
        param: { topicId },
      })
      if (!res.ok) return []
      const data = await res.json()
      const parsed = goodQuestionsListResponseSchema.parse(data)
      return parsed.questions
    },
  })
}

// ノートのソースを判定するヘルパー
const getNoteSource = (note: NoteWithOptionalSource): NoteSource => {
  if (note.source) return note.source
  return note.sessionId ? "chat" : "manual"
}

// ソースラベルコンポーネント
const NoteSourceLabel = ({ source }: { source: NoteSource }) => {
  if (source === "chat") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
        チャット
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-medium bg-amber-100 text-amber-700 rounded-full">
      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
      手動
    </span>
  )
}

// ノート作成モーダル
type CreateNoteModalProps = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { userMemo: string; keyPoints: string[]; stumbledPoints: string[] }) => void
  isSubmitting: boolean
}

const CreateNoteModal = ({ isOpen, onClose, onSubmit, isSubmitting }: CreateNoteModalProps) => {
  const [userMemo, setUserMemo] = useState("")
  const [keyPointInput, setKeyPointInput] = useState("")
  const [keyPoints, setKeyPoints] = useState<string[]>([])
  const [stumbledPointInput, setStumbledPointInput] = useState("")
  const [stumbledPoints, setStumbledPoints] = useState<string[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userMemo.trim()) return

    onSubmit({
      userMemo: userMemo.trim(),
      keyPoints: keyPoints.filter(Boolean),
      stumbledPoints: stumbledPoints.filter(Boolean),
    })
  }

  const handleClose = () => {
    setUserMemo("")
    setKeyPointInput("")
    setKeyPoints([])
    setStumbledPointInput("")
    setStumbledPoints([])
    onClose()
  }

  const addKeyPoint = () => {
    if (keyPointInput.trim() && keyPoints.length < 50) {
      setKeyPoints([...keyPoints, keyPointInput.trim()])
      setKeyPointInput("")
    }
  }

  const removeKeyPoint = (index: number) => {
    setKeyPoints(keyPoints.filter((_, i) => i !== index))
  }

  const addStumbledPoint = () => {
    if (stumbledPointInput.trim() && stumbledPoints.length < 50) {
      setStumbledPoints([...stumbledPoints, stumbledPointInput.trim()])
      setStumbledPointInput("")
    }
  }

  const removeStumbledPoint = (index: number) => {
    setStumbledPoints(stumbledPoints.filter((_, i) => i !== index))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* モーダル本体 */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-soft-lg animate-scale-in overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-ink-100 bg-gradient-to-r from-ink-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center size-10 bg-amber-100 rounded-xl">
                <svg className="size-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </span>
              <div>
                <h2 className="text-lg font-semibold text-ink-900">ノートを追加</h2>
                <p className="text-xs text-ink-500">学習の気づきを記録しましょう</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-ink-400 hover:text-ink-600 hover:bg-ink-100 rounded-lg transition-colors"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 本文 */}
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              本文 <span className="text-crimson-500">*</span>
            </label>
            <textarea
              value={userMemo}
              onChange={(e) => setUserMemo(e.target.value)}
              placeholder="学習で理解したこと、気づいたことを書きましょう..."
              rows={5}
              maxLength={10000}
              className="w-full px-4 py-3 text-sm text-ink-800 placeholder:text-ink-400 bg-ink-50 border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none"
              required
            />
            <p className="mt-1 text-xs text-ink-400 text-right">
              {userMemo.length.toLocaleString()} / 10,000
            </p>
          </div>

          {/* キーポイント */}
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              <span className="inline-flex items-center gap-1">
                <span className="text-jade-500">✓</span>
                キーポイント
              </span>
              <span className="text-xs text-ink-400 font-normal ml-2">任意</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={keyPointInput}
                onChange={(e) => setKeyPointInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addKeyPoint()
                  }
                }}
                placeholder="重要なポイントを入力..."
                maxLength={1000}
                className="flex-1 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 bg-ink-50 border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-400 transition-all"
              />
              <button
                type="button"
                onClick={addKeyPoint}
                disabled={!keyPointInput.trim() || keyPoints.length >= 50}
                className="px-3 py-2 text-sm font-medium text-jade-700 bg-jade-100 hover:bg-jade-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加
              </button>
            </div>
            {keyPoints.length > 0 && (
              <ul className="space-y-1.5">
                {keyPoints.map((point, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 text-sm text-ink-700 bg-jade-50 border border-jade-100 rounded-lg group"
                  >
                    <span className="text-jade-500 mt-0.5">✓</span>
                    <span className="flex-1">{point}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyPoint(i)}
                      className="p-0.5 text-ink-400 hover:text-crimson-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* つまずきポイント */}
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              <span className="inline-flex items-center gap-1">
                <span className="text-amber-500">!</span>
                つまずきポイント
              </span>
              <span className="text-xs text-ink-400 font-normal ml-2">任意</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={stumbledPointInput}
                onChange={(e) => setStumbledPointInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addStumbledPoint()
                  }
                }}
                placeholder="つまずいた点を入力..."
                maxLength={1000}
                className="flex-1 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 bg-ink-50 border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
              />
              <button
                type="button"
                onClick={addStumbledPoint}
                disabled={!stumbledPointInput.trim() || stumbledPoints.length >= 50}
                className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加
              </button>
            </div>
            {stumbledPoints.length > 0 && (
              <ul className="space-y-1.5">
                {stumbledPoints.map((point, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 text-sm text-ink-700 bg-amber-50 border border-amber-100 rounded-lg group"
                  >
                    <span className="text-amber-500 mt-0.5">!</span>
                    <span className="flex-1">{point}</span>
                    <button
                      type="button"
                      onClick={() => removeStumbledPoint(i)}
                      className="p-0.5 text-ink-400 hover:text-crimson-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-ink-100 bg-ink-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-800 hover:bg-ink-200 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!userMemo.trim() || isSubmitting}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin size-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                作成中...
              </>
            ) : (
              "作成する"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

type Props = {
  topicId: string
}

export const TopicNotes = ({ topicId }: Props) => {
  const { data, isLoading, error } = useNotesByTopic(topicId)
  const { mutate: refreshNote, isPending: isRefreshing } = useRefreshNote(topicId)
  const { mutate: createManualNote, isPending: isCreating } = useCreateManualNote(topicId)
  const { mutate: deleteNoteMutate, isPending: isDeleting } = useDeleteNote(topicId)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [refreshingNoteId, setRefreshingNoteId] = useState<string | null>(null)
  const [showDeepDiveQuestions, setShowDeepDiveQuestions] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null)

  const notes: NoteWithOptionalSource[] = data?.notes || []

  // 深掘り質問をバッチ取得（N+1解消）
  const { data: goodQuestions, isLoading: isLoadingQuestions } =
    useGoodQuestionsByTopic(topicId)

  const handleCreateNote = useCallback(
    (data: { userMemo: string; keyPoints: string[]; stumbledPoints: string[] }) => {
      createManualNote(data, {
        onSuccess: () => {
          setIsCreateModalOpen(false)
        },
      })
    },
    [createManualNote]
  )

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

  const toggleNote = (noteId: string) => {
    setExpandedNoteId(expandedNoteId === noteId ? null : noteId)
  }

  return (
    <div className="p-4 space-y-4">
      {/* ノート追加ボタン */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 border-dashed rounded-xl transition-colors group"
      >
        <svg
          className="size-5 text-indigo-500 group-hover:scale-110 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        ノートを追加
      </button>

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

      {/* 空状態 */}
      {notes.length === 0 && (
        <div className="py-8 text-center text-ink-500">
          <div className="flex justify-center mb-3">
            <span className="flex items-center justify-center size-12 bg-ink-100 rounded-full">
              <svg className="size-6 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </span>
          </div>
          <p className="mb-1 font-medium">この論点のノートはまだありません</p>
          <p className="text-sm">
            上のボタンからノートを作成できます
          </p>
        </div>
      )}

      {/* ノート一覧 */}
      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => {
            const isExpanded = expandedNoteId === note.id
            const source = getNoteSource(note)
            const displayContent = source === "chat" ? note.aiSummary : note.userMemo

            return (
              <div
                key={note.id}
                className="bg-white border border-ink-100 rounded-xl overflow-hidden shadow-soft hover:shadow-soft-lg transition-shadow"
              >
                {/* ヘッダー（クリックで展開） */}
                <button
                  onClick={() => toggleNote(note.id)}
                  className="w-full p-4 text-left hover:bg-ink-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <NoteSourceLabel source={source} />
                      </div>
                      <p className={`text-ink-800 text-sm ${isExpanded ? "" : "line-clamp-2"}`}>
                        {displayContent || <span className="text-ink-400 italic">内容なし</span>}
                      </p>
                    </div>
                    <span className="text-ink-400 flex-shrink-0 mt-1">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-ink-500">
                    <span>
                      {new Date(note.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                    {note.keyPoints.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="text-jade-500">✓</span>
                        {note.keyPoints.length} ポイント
                      </span>
                    )}
                    {note.stumbledPoints.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="text-amber-500">!</span>
                        {note.stumbledPoints.length} つまずき
                      </span>
                    )}
                  </div>
                </button>

                {/* 展開コンテンツ */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-ink-100 bg-ink-50/50">
                    {/* チャットノートの場合はAI要約を表示 */}
                    {source === "chat" && note.aiSummary && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-ink-600 mb-1">
                          AI要約
                        </h4>
                        <p className="text-sm text-ink-700 whitespace-pre-wrap">
                          {note.aiSummary}
                        </p>
                      </div>
                    )}

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

                    {/* ユーザーメモ（チャットノートの場合のみ追加表示） */}
                    {source === "chat" && note.userMemo && (
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
                      <div className="flex items-center gap-3">
                        {/* チャット由来のみ再生成ボタンを表示 */}
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
                        {/* 削除ボタン */}
                        <button
                          onClick={() => setNoteToDelete(note.id)}
                          className="text-sm text-ink-400 hover:text-crimson-600 flex items-center gap-1 transition-colors"
                          title="削除"
                        >
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ノート作成モーダル */}
      <CreateNoteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateNote}
        isSubmitting={isCreating}
      />

      {/* 削除確認モーダル */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setNoteToDelete(null)}
          />
          <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-soft-lg animate-scale-in overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center size-10 bg-crimson-100 rounded-xl">
                  <svg className="size-5 text-crimson-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </span>
                <h3 className="text-lg font-semibold text-ink-900">ノートを削除</h3>
              </div>
              <p className="text-sm text-ink-600 mb-6">
                このノートを削除しますか？この操作は取り消せません。
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setNoteToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-800 hover:bg-ink-100 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    deleteNoteMutate(noteToDelete, {
                      onSuccess: () => {
                        setNoteToDelete(null)
                        setExpandedNoteId(null)
                      },
                    })
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-crimson-600 hover:bg-crimson-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin size-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      削除中...
                    </>
                  ) : (
                    "削除する"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
