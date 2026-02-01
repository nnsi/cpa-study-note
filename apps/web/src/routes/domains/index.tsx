import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getColorClass } from "@/lib/colorClasses"
import {
  getStudyDomains,
} from "@/features/study-domain/api"

export const Route = createFileRoute("/domains/")({
  beforeLoad: requireAuth,
  component: DomainsPage,
})

function DomainsPage() {
  const navigate = useNavigate()

  // Fetch user's study domains
  const {
    data: domainsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["study-domains"],
    queryFn: getStudyDomains,
  })

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <div className="h-10 w-48 skeleton rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-2xl" />
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

  const domains = domainsData?.studyDomains ?? []

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
        <div className="ornament-line pb-4">
          <h1 className="heading-serif text-2xl lg:text-3xl">学習領域</h1>
        </div>

        {domains.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mx-auto mb-6">
              <svg className="size-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="heading-serif text-lg text-ink-700 mb-2">
              学習領域がありません
            </h3>
            <p className="text-sm text-ink-500 mb-6">
              ホームの「科目の構造を編集」から学習領域を作成してください
            </p>
            <Link to="/" className="btn-primary">
              ホームに戻る
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {domains.map((domain, index) => (
              <div
                key={domain.id}
                className="card-hover p-5 animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative flex items-start gap-4">
                  {/* Icon */}
                  <div className={`size-14 rounded-xl ${getColorClass(domain.color)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-3xl">{domain.emoji ?? "📚"}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-ink-900 text-lg mb-1">
                      {domain.name}
                    </h2>
                    {domain.description && (
                      <p className="text-sm text-ink-500 line-clamp-2 mb-3">
                        {domain.description}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/domains/$domainId/subjects", params: { domainId: domain.id } })}
                        className="btn-primary text-sm px-4 py-1.5"
                      >
                        開く
                      </button>
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
