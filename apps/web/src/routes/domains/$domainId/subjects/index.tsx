import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getColorClass } from "@/lib/colorClasses"
import { getStudyDomain } from "@/features/study-domain/api"
import { getSubjects } from "@/features/subject/api"

export const Route = createFileRoute("/domains/$domainId/subjects/")({
  beforeLoad: requireAuth,
  component: SubjectsPage,
})

function SubjectsPage() {
  const { domainId } = Route.useParams()

  // Fetch domain info
  const { data: domainData } = useQuery({
    queryKey: ["study-domain", domainId],
    queryFn: () => getStudyDomain(domainId),
  })

  // Fetch subjects
  const { data, isLoading, error } = useQuery({
    queryKey: ["subjects", { studyDomainId: domainId }],
    queryFn: () => getSubjects(domainId),
  })

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <div className="h-10 w-40 skeleton rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 skeleton rounded-2xl" />
            ))}
          </div>
        </div>
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper>
        <div className="card p-6 text-center">
          <div className="size-12 rounded-xl bg-crimson-400/10 flex items-center justify-center mx-auto mb-4">
            <svg className="size-6 text-crimson-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-crimson-500 font-medium">エラーが発生しました</p>
        </div>
      </PageWrapper>
    )
  }

  const subjects = data?.subjects ?? []

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
            <span>{domainData?.studyDomain.name ?? "..."}</span>
          </div>
          <h1 className="heading-serif text-2xl lg:text-3xl">科目一覧</h1>
        </div>

        {subjects.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mx-auto mb-6">
              <svg className="size-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="heading-serif text-lg text-ink-700 mb-2">
              科目がありません
            </h3>
            <p className="text-sm text-ink-500 mb-6">
              ホームの「科目の構造を編集」から科目を作成してください
            </p>
            <Link to="/" className="btn-primary">
              ホームに戻る
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {subjects.map((subject, index) => (
              <div
                key={subject.id}
                className="card-hover p-5 animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative flex items-start gap-4">
                  {/* アイコン */}
                  <div className={`size-12 rounded-xl ${getColorClass(subject.color)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-2xl">{subject.emoji ?? "📚"}</span>
                  </div>

                  {/* コンテンツ */}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-ink-900 text-lg">
                      {subject.name}
                    </h2>
                    {subject.description && (
                      <p className="text-sm text-ink-500 mt-1 line-clamp-2">
                        {subject.description}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3">
                      <Link
                        to="/domains/$domainId/subjects/$subjectId"
                        params={{ domainId, subjectId: subject.id }}
                        className="btn-primary text-sm px-4 py-1.5"
                      >
                        開く
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
