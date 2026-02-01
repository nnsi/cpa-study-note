import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getSubject } from "@/features/subject/api"
import { getStudyDomain } from "@/features/study-domain/api"
import { TreeEditor } from "@/features/subject/components"

export const Route = createFileRoute("/domains/$domainId/subjects/$subjectId/edit")({
  beforeLoad: requireAuth,
  component: SubjectEditPage,
})

function SubjectEditPage() {
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

  if (subjectLoading) {
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

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
        {/* Header with breadcrumb */}
        <div className="ornament-line pb-4">
          <div className="flex items-center gap-2 text-sm text-ink-500 mb-1">
            <Link to="/edit" className="hover:text-indigo-600 transition-colors">
              編集
            </Link>
            <span>/</span>
            <span>{domainData?.studyDomain.name ?? "..."}</span>
            <span>/</span>
            <span>{subjectData?.subject.name ?? "..."}</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="heading-serif text-2xl lg:text-3xl">
              {subjectData?.subject.name ?? "科目"} の構造を編集
            </h1>
            <Link
              to="/domains/$domainId/subjects/$subjectId"
              params={{ domainId, subjectId }}
              className="btn-secondary text-sm"
            >
              <svg className="size-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              学習画面を見る
            </Link>
          </div>
        </div>

        {/* Tree Editor */}
        <TreeEditor
          subjectId={subjectId}
          subjectName={subjectData?.subject.name ?? "科目"}
        />
      </div>
    </PageWrapper>
  )
}
