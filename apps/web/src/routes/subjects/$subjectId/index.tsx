import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export const Route = createFileRoute("/subjects/$subjectId/")({
  component: SubjectDetailPage,
})

type CategoryNode = {
  id: string
  name: string
  depth: number
  children: CategoryNode[]
}

function SubjectDetailPage() {
  const { subjectId } = Route.useParams()

  const { data: subject } = useQuery({
    queryKey: ["subjects", subjectId],
    queryFn: async () => {
      const res = await api.api.subjects[":subjectId"].$get({
        param: { subjectId },
      })
      if (!res.ok) throw new Error("Failed to fetch subject")
      return res.json()
    },
  })

  const { data: categories, isLoading } = useQuery({
    queryKey: ["subjects", subjectId, "categories"],
    queryFn: async () => {
      const res = await api.api.subjects[":subjectId"].categories.$get({
        param: { subjectId },
      })
      if (!res.ok) throw new Error("Failed to fetch categories")
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <Link to="/subjects" className="text-blue-600 hover:underline text-sm">
          ← 科目一覧
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          {subject?.subject.name}
        </h1>
      </div>

      <div className="space-y-2">
        {categories?.categories.map((category) => (
          <CategoryItem
            key={category.id}
            category={category}
            subjectId={subjectId}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryItem({
  category,
  subjectId,
}: {
  category: CategoryNode
  subjectId: string
}) {
  const hasChildren = category.children.length > 0
  const paddingLeft = category.depth * 16

  return (
    <div>
      <Link
        to="/subjects/$subjectId/$categoryId"
        params={{ subjectId, categoryId: category.id }}
        className="block py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors"
        style={{ paddingLeft: paddingLeft + 16 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400">
            {hasChildren ? "📂" : "📄"}
          </span>
          <span className="text-gray-900">{category.name}</span>
        </div>
      </Link>
      {hasChildren && (
        <div>
          {category.children.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              subjectId={subjectId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
