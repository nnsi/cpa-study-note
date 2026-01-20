import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"

export const Route = createFileRoute("/subjects/$subjectId/$categoryId/")({
  beforeLoad: requireAuth,
  component: CategoryPage,
})

function CategoryPage() {
  const { subjectId, categoryId } = Route.useParams()

  const { data: topics, isLoading } = useQuery({
    queryKey: ["subjects", subjectId, "categories", categoryId, "topics"],
    queryFn: async () => {
      const res = await api.api.subjects[":subjectId"].categories[
        ":categoryId"
      ].topics.$get({
        param: { subjectId, categoryId },
      })
      if (!res.ok) throw new Error("Failed to fetch topics")
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <Link
          to="/subjects/$subjectId"
          params={{ subjectId }}
          className="text-blue-600 hover:underline text-sm"
        >
          ← カテゴリ一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">論点一覧</h1>
      </div>

      <div className="space-y-3">
        {topics?.topics.map((topic) => (
          <Link
            key={topic.id}
            to="/subjects/$subjectId/$categoryId/$topicId"
            params={{ subjectId, categoryId, topicId: topic.id }}
            className="card block hover:shadow-md transition-shadow"
          >
            <h2 className="font-medium text-gray-900">{topic.name}</h2>
            {topic.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {topic.description}
              </p>
            )}
          </Link>
        ))}

        {topics?.topics.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            このカテゴリには論点がありません
          </p>
        )}
      </div>
    </div>
  )
}
