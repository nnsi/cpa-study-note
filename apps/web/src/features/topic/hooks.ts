import { useQuery } from "@tanstack/react-query"
import * as api from "./api"

export const useCheckHistory = (subjectId: string, topicId: string) => {
  return useQuery({
    queryKey: ["check-history", topicId],
    queryFn: () => api.getCheckHistory(subjectId, topicId),
  })
}
