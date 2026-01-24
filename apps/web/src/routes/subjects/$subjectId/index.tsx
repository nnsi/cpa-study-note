import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"

export const Route = createFileRoute("/subjects/$subjectId/")({
  beforeLoad: requireAuth,
  component: SubjectDetailPage,
})

type CategoryNode = {
  id: string
  name: string
  depth: number
  topicCount: number
  understoodCount: number
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
      if (!res.ok) throw new Error(`科目の取得に失敗しました (${res.status})`)
      return res.json()
    },
  })

  const { data: categories, isLoading } = useQuery({
    queryKey: ["subjects", subjectId, "categories"],
    queryFn: async () => {
      const res = await api.api.subjects[":subjectId"].categories.$get({
        param: { subjectId },
      })
      if (!res.ok) throw new Error(`カテゴリの取得に失敗しました (${res.status})`)
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <Link to="/subjects" className="text-indigo-600 hover:underline text-sm">
          ← 科目一覧
        </Link>
        <h1 className="text-2xl font-bold text-ink-900 mt-2">
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

// カテゴリと子カテゴリの合計を計算
function getTotalCounts(category: CategoryNode): {
  topicCount: number
  understoodCount: number
} {
  let topicCount = category.topicCount
  let understoodCount = category.understoodCount

  for (const child of category.children) {
    const childCounts = getTotalCounts(child)
    topicCount += childCounts.topicCount
    understoodCount += childCounts.understoodCount
  }

  return { topicCount, understoodCount }
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
  const totals = getTotalCounts(category)

  // 子カテゴリがある場合はリンクにしない（クリックしても遷移しない）
  const itemContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-ink-400">
          {hasChildren ? "📂" : "📄"}
        </span>
        <span className="text-ink-800">{category.name}</span>
      </div>
      {totals.topicCount > 0 && (
        <span
          className={`text-sm ${
            totals.understoodCount === totals.topicCount
              ? "text-jade-600 font-medium"
              : "text-ink-500"
          }`}
        >
          {totals.understoodCount}/{totals.topicCount}
        </span>
      )}
    </div>
  )

  return (
    <div>
      {hasChildren ? (
        <div
          className="block py-3.5 px-4 rounded-xl"
          style={{ paddingLeft: paddingLeft + 16 }}
        >
          {itemContent}
        </div>
      ) : (
        <Link
          to="/subjects/$subjectId/$categoryId"
          params={{ subjectId, categoryId: category.id }}
          className="block py-3.5 px-4 rounded-xl hover:bg-ink-50 transition-colors"
          style={{ paddingLeft: paddingLeft + 16 }}
        >
          {itemContent}
        </Link>
      )}
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
