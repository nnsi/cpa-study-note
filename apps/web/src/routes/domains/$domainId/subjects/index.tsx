import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getColorClass } from "@/lib/colorClasses"

export const Route = createFileRoute("/domains/$domainId/subjects/")({
  beforeLoad: requireAuth,
  component: SubjectsPage,
})

function SubjectsPage() {
  const { domainId } = Route.useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ["subjects", { studyDomainId: domainId }],
    queryFn: async () => {
      const res = await api.api.subjects.$get({ query: { studyDomainId: domainId } })
      if (!res.ok) throw new Error(`科目の取得に失敗しました (${res.status})`)
      return res.json()
    },
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

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
      <div className="ornament-line pb-4">
        <h1 className="heading-serif text-2xl lg:text-3xl">論点マップ</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data?.subjects.map((subject, index) => (
          <Link
            key={subject.id}
            to="/domains/$domainId/subjects/$subjectId"
            params={{ domainId, subjectId: subject.id }}
            className={`card-hover p-5 group animate-fade-in-up`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="relative flex items-start gap-4">
              {/* アイコン */}
              <div className={`size-12 rounded-xl ${getColorClass(subject.color)} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                <span className="text-2xl">{subject.emoji ?? "📚"}</span>
              </div>

              {/* コンテンツ */}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-ink-900 text-lg group-hover:text-indigo-600 transition-colors">
                  {subject.name}
                </h2>
                <p className="text-sm text-ink-500 mt-1">
                  <span className="text-ink-600 font-medium">{subject.categoryCount}</span> 単元 /
                  <span className="text-ink-600 font-medium"> {subject.topicCount}</span> 論点
                </p>
                {subject.description && (
                  <p className="text-sm text-ink-500 mt-2 line-clamp-2">
                    {subject.description}
                  </p>
                )}
              </div>

              {/* 矢印 */}
              <div className="text-ink-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all duration-300 self-center">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
    </PageWrapper>
  )
}
