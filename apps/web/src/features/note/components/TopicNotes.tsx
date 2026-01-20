import { Link } from "@tanstack/react-router"
import { useNotesByTopic } from "../hooks"

type Props = {
  topicId: string
}

export const TopicNotes = ({ topicId }: Props) => {
  const { data, isLoading, error } = useNotesByTopic(topicId)

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        ノートの取得に失敗しました
      </div>
    )
  }

  const notes = data?.notes || []

  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="mb-2">この論点のノートはまだありません</p>
        <p className="text-sm">
          チャットで学習した後、ノートを作成できます
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {notes.map((note) => (
        <Link
          key={note.id}
          to="/notes/$noteId"
          params={{ noteId: note.id }}
          className="block p-3 bg-white border rounded-lg hover:shadow-md transition-shadow"
        >
          <p className="text-gray-900 text-sm line-clamp-2">
            {note.aiSummary}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>
              {new Date(note.createdAt).toLocaleDateString("ja-JP")}
            </span>
            {note.keyPoints.length > 0 && (
              <span>{note.keyPoints.length} ポイント</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
