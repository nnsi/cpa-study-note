import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getSubject, getSubjectTree, type CategoryNode } from "@/features/subject/api"
import { getStudyDomain } from "@/features/study-domain/api"

export const Route = createFileRoute("/domains/$domainId/subjects/$subjectId/")({
  beforeLoad: requireAuth,
  component: SubjectDetailPage,
})

function SubjectDetailPage() {
  const { domainId, subjectId } = Route.useParams()

  // Fetch domain info
  const { data: domainData } = useQuery({
    queryKey: ["study-domain", domainId],
    queryFn: () => getStudyDomain(domainId),
  })

  // Fetch subject info
  const { data: subjectData } = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: () => getSubject(subjectId),
  })

  // Fetch tree
  const { data: treeData, isLoading } = useQuery({
    queryKey: ["subject-tree", subjectId],
    queryFn: () => getSubjectTree(subjectId),
  })

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="animate-pulse space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 skeleton rounded-xl" />
          ))}
        </div>
      </PageWrapper>
    )
  }

  const categories = treeData?.tree.categories ?? []

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
        {/* Header with breadcrumb */}
        <div className="ornament-line pb-4">
          <div className="flex items-center gap-2 text-sm text-ink-500 mb-1">
            <Link to="/domains" className="hover:text-indigo-600 transition-colors">
              学習領域
            </Link>
            <span>/</span>
            <Link
              to="/domains/$domainId/subjects"
              params={{ domainId }}
              className="hover:text-indigo-600 transition-colors"
            >
              {domainData?.studyDomain.name ?? "..."}
            </Link>
            <span>/</span>
            <span>{subjectData?.subject.name ?? "..."}</span>
          </div>
          <h1 className="heading-serif text-2xl lg:text-3xl">
            {subjectData?.subject.name ?? "科目"}
          </h1>
        </div>

        {categories.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mx-auto mb-6">
              <svg className="size-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </div>
            <h3 className="heading-serif text-lg text-ink-700 mb-2">
              単元がありません
            </h3>
            <p className="text-sm text-ink-500 mb-6">
              CSVインポートまたはエディタで単元・論点を追加してください
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                domainId={domainId}
                subjectId={subjectId}
              />
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}

function CategorySection({
  category,
  domainId,
  subjectId,
}: {
  category: CategoryNode
  domainId: string
  subjectId: string
}) {
  const totalTopics = category.subcategories.reduce(
    (sum, sub) => sum + sub.topics.length,
    0
  )

  return (
    <div className="card overflow-hidden">
      {/* Category Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-transparent px-5 py-4 border-b border-ink-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">📂</span>
            <h2 className="font-semibold text-ink-900">{category.name}</h2>
          </div>
          <span className="text-sm text-ink-500">
            {category.subcategories.length} 中単元 / {totalTopics} 論点
          </span>
        </div>
      </div>

      {/* Subcategories */}
      <div className="divide-y divide-ink-100">
        {category.subcategories.map((subcategory) => (
          <div key={subcategory.id} className="p-4">
            <div className="flex items-center gap-2 text-ink-600 mb-3">
              <span>📁</span>
              <span className="font-medium">{subcategory.name}</span>
              <span className="text-sm text-ink-400">({subcategory.topics.length})</span>
            </div>

            {/* Topics */}
            <div className="ml-6 space-y-1.5">
              {subcategory.topics.map((topic) => (
                <Link
                  key={topic.id}
                  to="/domains/$domainId/subjects/$subjectId/$categoryId/$topicId"
                  params={{
                    domainId,
                    subjectId,
                    categoryId: subcategory.id,
                    topicId: topic.id,
                  }}
                  className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-ink-50 transition-colors group"
                >
                  <span className="text-ink-300 group-hover:text-indigo-500">📄</span>
                  <span className="text-ink-700 group-hover:text-indigo-600 transition-colors">
                    {topic.name}
                  </span>
                  {topic.difficulty && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      topic.difficulty === "basic"
                        ? "bg-jade-100 text-jade-700"
                        : topic.difficulty === "intermediate"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-crimson-100 text-crimson-700"
                    }`}>
                      {topic.difficulty === "basic" ? "基礎" : topic.difficulty === "intermediate" ? "標準" : "応用"}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
