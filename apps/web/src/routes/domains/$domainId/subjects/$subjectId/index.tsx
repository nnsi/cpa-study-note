import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getSubject, getSubjectTree, type CategoryNode } from "@/features/subject/api"
import { getStudyDomain } from "@/features/study-domain/api"
import { filterTopics, type FilteredTopic } from "@/features/review/api"
import { getMyProgress } from "@/features/progress/api"
import { BookmarkButton } from "@/features/bookmark"

export const Route = createFileRoute("/domains/$domainId/subjects/$subjectId/")({
  beforeLoad: requireAuth,
  component: SubjectCategoriesPage,
})

function SubjectCategoriesPage() {
  const { domainId, subjectId } = Route.useParams()

  // Fetch domain info
  const { data: domainData } = useQuery({
    queryKey: ["study-domain", domainId],
    queryFn: () => getStudyDomain(domainId),
  })

  // Fetch subject info
  const { data: subjectData, isLoading: subjectLoading } = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: () => getSubject(subjectId),
  })

  // Fetch tree structure
  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ["subject-tree", subjectId],
    queryFn: () => getSubjectTree(subjectId),
  })

  // Fetch user progress
  const { data: progressData } = useQuery({
    queryKey: ["progress", "me"],
    queryFn: getMyProgress,
  })

  // Fetch topic stats for session counts
  const { data: topicStatsData } = useQuery({
    queryKey: ["topics", "stats"],
    queryFn: () => filterTopics({}),
  })

  // Create progress map by topic ID
  type Progress = { topicId: string; understood: boolean }
  const progressMap = new Map<string, Progress>(
    progressData?.progress.map((p: Progress) => [p.topicId, p]) ?? []
  )

  // Create stats map by topic ID
  const statsMap = new Map<string, FilteredTopic>(
    topicStatsData?.map((t) => [t.id, t]) ?? []
  )

  const isLoading = subjectLoading || treeLoading

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 skeleton rounded-xl" />
            ))}
          </div>
        </div>
      </PageWrapper>
    )
  }

  const categories = treeData?.tree.categories ?? []

  // Calculate stats for each subcategory
  const getSubcategoryStats = (subcategory: CategoryNode["subcategories"][0]) => {
    const topicCount = subcategory.topics.length
    const understoodCount = subcategory.topics.filter(
      (t) => progressMap.get(t.id)?.understood
    ).length
    const sessionCount = subcategory.topics.reduce(
      (sum, t) => sum + (statsMap.get(t.id)?.sessionCount ?? 0),
      0
    )
    return { topicCount, understoodCount, sessionCount }
  }

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
          <div className="flex items-center gap-3">
            <h1 className="heading-serif text-2xl lg:text-3xl">
              {subjectData?.subject.name ?? "科目"}
            </h1>
            <BookmarkButton targetType="subject" targetId={subjectId} size="md" />
          </div>
        </div>

        {/* Categories list */}
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
              ホームの「科目の構造を編集」から単元を作成してください
            </p>
            <Link to="/" className="btn-primary">
              ホームに戻る
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category, categoryIdx) => (
              <div
                key={category.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${categoryIdx * 50}ms` }}
              >
                {/* Category header (大単元) */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                  </div>
                  <h2 className="font-semibold text-ink-800 text-lg">{category.name}</h2>
                </div>

                {/* Subcategories (中単元) */}
                {category.subcategories.length === 0 ? (
                  <div className="text-sm text-ink-500 pl-11">
                    この大単元には中単元がありません
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 pl-11">
                    {category.subcategories.map((subcategory) => {
                      const stats = getSubcategoryStats(subcategory)
                      const isAllUnderstood = stats.topicCount > 0 && stats.understoodCount === stats.topicCount

                      return (
                        <Link
                          key={subcategory.id}
                          to="/domains/$domainId/subjects/$subjectId/$categoryId"
                          params={{ domainId, subjectId, categoryId: subcategory.id }}
                          className={`card-hover p-4 ${
                            isAllUnderstood
                              ? "border-jade-200 bg-jade-50/50"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`size-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isAllUnderstood
                                ? "bg-jade-100 text-jade-600"
                                : "bg-ink-100 text-ink-500"
                            }`}>
                              {isAllUnderstood ? (
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              ) : (
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-medium ${
                                isAllUnderstood ? "text-jade-700" : "text-ink-800"
                              }`}>
                                {subcategory.name}
                              </h3>
                              <div className="flex items-center gap-3 mt-1.5 text-sm">
                                <span className={`${
                                  isAllUnderstood ? "text-jade-600" : "text-ink-500"
                                }`}>
                                  論点 {stats.topicCount}件
                                </span>
                                {stats.topicCount > 0 && (
                                  <span className={`flex items-center gap-1 ${
                                    isAllUnderstood ? "text-jade-600" : "text-ink-500"
                                  }`}>
                                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                    {stats.understoodCount}/{stats.topicCount}
                                  </span>
                                )}
                                {stats.sessionCount > 0 && (
                                  <span className="text-ink-400 flex items-center gap-1">
                                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                                    </svg>
                                    {stats.sessionCount}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-ink-300 group-hover:text-indigo-500 transition-colors">
                              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                              </svg>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
