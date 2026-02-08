import { createFileRoute } from "@tanstack/react-router"
import { PageWrapper } from "@/components/layout"
import { StudyPlanDetail } from "@/features/study-plan"

export const Route = createFileRoute("/plans/$planId")({
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
