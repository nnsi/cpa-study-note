import { createFileRoute, redirect } from "@tanstack/react-router"
import { DEFAULT_STUDY_DOMAIN_ID } from "@cpa-study/shared/constants"

export const Route = createFileRoute("/subjects/$subjectId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/domains/$domainId/subjects/$subjectId",
      params: { domainId: DEFAULT_STUDY_DOMAIN_ID, subjectId: params.subjectId },
      replace: true,
    })
  },
})
