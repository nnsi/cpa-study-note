import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"

export const Route = createFileRoute("/subjects/")({
  beforeLoad: requireAuth,
  component: SubjectsPage,
})

function SubjectsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const res = await api.api.subjects.$get()
      if (!res.ok) throw new Error(`科目の取得に失敗しました (${res.status})`)
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg" />
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">論点マップ</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {data?.subjects.map((subject) => (
          <Link
            key={subject.id}
            to="/subjects/$subjectId"
            params={{ subjectId: subject.id }}
            className="card hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">
                {getSubjectEmoji(subject.name)}
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">
                  {subject.name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {subject.categoryCount} カテゴリ / {subject.topicCount} 論点
                </p>
                {subject.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                    {subject.description}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

/** 科目名に対応する絵文字を返す（公認会計士試験科目固定） */
function getSubjectEmoji(name: string): string {
  const emojiMap: Record<string, string> = {
    財務会計論: "📘",
    管理会計論: "📗",
    監査論: "📙",
    企業法: "📕",
    租税法: "📓",
    経営学: "📒",
    経済学: "📔",
    民法: "📖",
  }
  return emojiMap[name] || "📚"
}
