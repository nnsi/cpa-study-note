import { createFileRoute } from "@tanstack/react-router"
import { PageWrapper } from "@/components/layout"
import { StudyPlanList } from "@/features/study-plan"
import { requireAuth } from "@/lib/auth"

export const Route = createFileRoute("/plans/")({
  beforeLoad: requireAuth,
  component: PlansPage,
})

function PlansPage() {
  return (
    <PageWrapper>
      <StudyPlanList />
    </PageWrapper>
  )
}
