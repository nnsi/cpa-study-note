import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getSubject } from "@/features/subject/api"
import { getStudyDomain } from "@/features/study-domain/api"
import { TreeEditor } from "@/features/subject/components"

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

        {/* Tree Editor */}
        <TreeEditor
          subjectId={subjectId}
          subjectName={subjectData?.subject.name ?? "科目"}
        />
      </div>
    </PageWrapper>
  )
}
