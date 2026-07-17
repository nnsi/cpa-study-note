import { createFileRoute, redirect } from "@tanstack/react-router"
import { requireAuth } from "@/lib/auth"
import { getSubject } from "@/features/subject/api"

export const Route = createFileRoute("/subjects/$subjectId/$categoryId/$topicId")({
  beforeLoad: async ({ params }) => {
    requireAuth()
    const { subject } = await getSubject(params.subjectId)
    throw redirect({
      to: "/domains/$domainId/subjects/$subjectId/$categoryId/$topicId",
      params: {
        domainId: subject.studyDomainId,
        subjectId: params.subjectId,
        categoryId: params.categoryId,
        topicId: params.topicId,
      },
      replace: true,
    })
  },
})
