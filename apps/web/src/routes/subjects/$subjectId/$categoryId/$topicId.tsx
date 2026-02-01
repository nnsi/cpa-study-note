import { createFileRoute, redirect } from "@tanstack/react-router"
import { DEFAULT_STUDY_DOMAIN_ID } from "@cpa-study/shared/constants"

export const Route = createFileRoute("/subjects/$subjectId/$categoryId/$topicId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/domains/$domainId/subjects/$subjectId/$categoryId/$topicId",
      params: {
        domainId: DEFAULT_STUDY_DOMAIN_ID,
        subjectId: params.subjectId,
        categoryId: params.categoryId,
        topicId: params.topicId,
      },
      replace: true,
    })
  },
})
