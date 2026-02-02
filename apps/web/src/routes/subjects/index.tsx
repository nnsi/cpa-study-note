import { createFileRoute, redirect } from "@tanstack/react-router"
import { requireAuth } from "@/lib/auth"
import { getStudyDomains } from "@/features/study-domain/api"

export const Route = createFileRoute("/subjects/")({
  beforeLoad: requireAuth,
  loader: async () => {
    const data = await getStudyDomains()
    const domains = data.studyDomains

    // 学習領域が1つなら直接その科目一覧へ
    if (domains.length === 1) {
      throw redirect({
        to: "/domains/$domainId/subjects",
        params: { domainId: domains[0].id },
        replace: true,
      })
    }

    // 複数または0件なら学習領域選択へ
    throw redirect({
      to: "/domains",
      replace: true,
    })
  },
})
