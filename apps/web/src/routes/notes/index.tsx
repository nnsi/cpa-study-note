import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export const Route = createFileRoute("/notes/")({
  component: NotesPage,
})

function NotesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const res = await api.api.notes.$get()
      if (!res.ok) throw new Error("Failed to fetch notes")
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 lg:p-6">
        <div className="text-red-600">エラーが発生しました</div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ノート</h1>

      {data?.notes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">まだノートがありません</p>
          <p className="text-sm">
            チャットで学習した後、ノートを作成できます
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.notes.map((note) => (
            <Link
              key={note.id}
              to="/notes/$noteId"
              params={{ noteId: note.id }}
              className="card block hover:shadow-md transition-shadow"
            >
              <div className="space-y-2">
                <p className="text-gray-900 line-clamp-2">{note.aiSummary}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    {new Date(note.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                  {note.keyPoints.length > 0 && (
                    <span>{note.keyPoints.length} ポイント</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
