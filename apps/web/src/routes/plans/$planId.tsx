import { createFileRoute } from "@tanstack/react-router"
import { PageWrapper } from "@/components/layout"
import { StudyPlanDetail } from "@/features/study-plan"
import { requireAuth } from "@/lib/auth"

export const Route = createFileRoute("/plans/$planId")({
  beforeLoad: requireAuth,
  component: PlanDetailPage,
})

function PlanDetailPage() {
  const { planId } = Route.useParams()
  return (
    <PageWrapper>
      <StudyPlanDetail planId={planId} />
    </PageWrapper>
  )
}
