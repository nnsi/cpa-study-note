import { createFileRoute, redirect } from "@tanstack/react-router"
import { DEFAULT_STUDY_DOMAIN_ID } from "@cpa-study/shared/constants"

export const Route = createFileRoute("/subjects/$subjectId/$categoryId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/domains/$domainId/subjects/$subjectId/$categoryId",
      params: {
        domainId: DEFAULT_STUDY_DOMAIN_ID,
        subjectId: params.subjectId,
        categoryId: params.categoryId,
      },
      replace: true,
    })
  },
})
