import { createFileRoute, redirect } from "@tanstack/react-router"
import { requireAuth } from "@/lib/auth"
import { getSubject } from "@/features/subject/api"

export const Route = createFileRoute("/subjects/$subjectId/")({
  beforeLoad: async ({ params }) => {
    requireAuth()
    const { subject } = await getSubject(params.subjectId)
    throw redirect({
      to: "/domains/$domainId/subjects/$subjectId",
      params: { domainId: subject.studyDomainId, subjectId: params.subjectId },
      replace: true,
    })
  },
})
