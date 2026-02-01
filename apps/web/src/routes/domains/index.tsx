import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getColorClass } from "@/lib/colorClasses"

export const Route = createFileRoute("/domains/")({
  beforeLoad: requireAuth,
  component: DomainsPage,
})

function DomainsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch public study domains
  const {
    data: publicDomainsData,
    isLoading: isLoadingPublic,
    error: publicError,
  } = useQuery({
    queryKey: ["study-domains"],
    queryFn: async () => {
      const res = await api.api["study-domains"].$get()
      if (!res.ok) throw new Error(`学習領域の取得に失敗しました (${res.status})`)
      return res.json()
    },
  })

  // Fetch user's joined study domains
  const {
    data: userDomainsData,
    isLoading: isLoadingUser,
  } = useQuery({
    queryKey: ["user-study-domains"],
    queryFn: async () => {
      const res = await api.api.me["study-domains"].$get()
      if (!res.ok) throw new Error(`参加中の学習領域の取得に失敗しました (${res.status})`)
      return res.json()
    },
  })

  // Join study domain mutation
  const joinMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const res = await api.api.me["study-domains"][":id"].join.$post({
        param: { id: domainId },
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error((error as { error?: string }).error ?? "参加に失敗しました")
      }
      return res.json()
    },
    onSuccess: (_, domainId) => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["user-study-domains"] })
      // Redirect to the domain's subjects page
      navigate({ to: "/domains/$domainId/subjects", params: { domainId } })
    },
  })

  // Set of joined domain IDs for quick lookup
  const joinedDomainIds = new Set(
    userDomainsData?.userStudyDomains.map((ud) => ud.studyDomainId) ?? []
  )

  const isLoading = isLoadingPublic || isLoadingUser

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

  if (publicError) {
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

  const domains = publicDomainsData?.studyDomains ?? []

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
        <div className="ornament-line pb-4">
          <h1 className="heading-serif text-2xl lg:text-3xl">学習領域を探す</h1>
        </div>

        {domains.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mx-auto mb-6">
              <svg className="size-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="heading-serif text-lg text-ink-700 mb-2">
              公開中の学習領域がありません
            </h3>
            <p className="text-sm text-ink-500">
              学習領域が公開されるまでお待ちください
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {domains.map((domain, index) => {
              const isJoined = joinedDomainIds.has(domain.id)
              const isJoining = joinMutation.isPending && joinMutation.variables === domain.id

              return (
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
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-semibold text-ink-900 text-lg">
                          {domain.name}
                        </h2>
                        {isJoined && (
                          <span className="badge-primary text-xs">
                            参加中
                          </span>
                        )}
                      </div>
                      {domain.description && (
                        <p className="text-sm text-ink-500 line-clamp-2 mb-3">
                          {domain.description}
                        </p>
                      )}

                      {/* Action Button */}
                      {isJoined ? (
                        <button
                          type="button"
                          onClick={() => navigate({ to: "/domains/$domainId/subjects", params: { domainId: domain.id } })}
                          className="btn-secondary text-sm px-4 py-1.5"
                        >
                          学習を続ける
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => joinMutation.mutate(domain.id)}
                          disabled={isJoining}
                          className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isJoining ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin size-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              参加中...
                            </span>
                          ) : (
                            "参加する"
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Error message */}
                  {joinMutation.isError && joinMutation.variables === domain.id && (
                    <div className="mt-3 p-2 bg-crimson-50 rounded-lg">
                      <p className="text-sm text-crimson-600">
                        {joinMutation.error?.message ?? "参加に失敗しました"}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
