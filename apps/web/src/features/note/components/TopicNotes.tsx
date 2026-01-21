import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useNotesByTopic } from "../hooks"

type Note = {
  id: string
  aiSummary: string | null
  userMemo: string | null
  keyPoints: string[]
  stumbledPoints: string[]
  createdAt: string
}

type Props = {
  topicId: string
}

export const TopicNotes = ({ topicId }: Props) => {
  const { data, isLoading, error } = useNotesByTopic(topicId)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

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

  const notes: Note[] = data?.notes || []

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
    <div className="p-4 space-y-3">
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

                {/* 編集リンク */}
                <div className="mt-3 pt-2 border-t border-ink-200">
                  <Link
                    to="/notes/$noteId"
                    params={{ noteId: note.id }}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    編集・詳細を見る →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
