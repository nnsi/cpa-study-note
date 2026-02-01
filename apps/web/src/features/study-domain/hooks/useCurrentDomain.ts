import { useQuery } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"
import * as api from "../api"

/**
 * URL パラメータから現在の学習領域IDを取得し、
 * オプションで詳細情報もフェッチするフック
 */
export function useCurrentDomain() {
  // /domains/:domainId/* パターンから domainId を取得
  // useParams はルートツリーから型を推論できないため、手動で型を指定
  const params = useParams({ strict: false }) as { domainId?: string }
  const domainId = params.domainId ?? null

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["study-domain", domainId],
    queryFn: () => api.getStudyDomain(domainId!),
    enabled: !!domainId,
  })

  return {
    domainId,
    domain: data?.studyDomain ?? null,
    isLoading: domainId ? isLoading : false,
    error,
  }
}
