import { createFileRoute } from "@tanstack/react-router"
import { PageWrapper } from "@/components/layout"
import { StudyPlanList } from "@/features/study-plan"

export const Route = createFileRoute("/plans/")({
  component: PlansPage,
})

function PlansPage() {
  return (
    <PageWrapper>
      <StudyPlanList />
    </PageWrapper>
  )
}
