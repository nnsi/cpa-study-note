import { createFileRoute, redirect } from "@tanstack/react-router"
import { DEFAULT_STUDY_DOMAIN_ID } from "@cpa-study/shared/constants"

export const Route = createFileRoute("/subjects/")({
  beforeLoad: () => {
    throw redirect({
      to: "/domains/$domainId/subjects",
      params: { domainId: DEFAULT_STUDY_DOMAIN_ID },
      replace: true,
    })
  },
})
