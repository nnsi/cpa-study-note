import { api, extractErrorMessage } from "@/lib/api-client"
import {
  studyDomainListResponseSchema,
  studyDomainSingleResponseSchema,
  bulkCSVImportResponseSchema,
  type StudyDomainResponse,
  type CreateStudyDomainRequest,
  type UpdateStudyDomainRequest,
  type BulkCSVImportResponse,
} from "@cpa-study/shared/schemas"

// Re-export types for convenience
export type StudyDomain = StudyDomainResponse
export type CreateStudyDomainInput = CreateStudyDomainRequest
export type UpdateStudyDomainInput = UpdateStudyDomainRequest
export type BulkCSVImportResult = BulkCSVImportResponse

export const getStudyDomains = async (): Promise<{ studyDomains: StudyDomain[] }> => {
  const res = await api.api["study-domains"].$get()
  if (!res.ok) throw new Error("学習領域の取得に失敗しました")
  const data = await res.json()
  return studyDomainListResponseSchema.parse(data)
}

export const getStudyDomain = async (id: string): Promise<{ studyDomain: StudyDomain }> => {
  const res = await api.api["study-domains"][":id"].$get({
    param: { id },
  })
  if (!res.ok) throw new Error("学習領域の取得に失敗しました")
  const data = await res.json()
  return studyDomainSingleResponseSchema.parse(data)
}

export const createStudyDomain = async (
  data: CreateStudyDomainInput
): Promise<{ studyDomain: StudyDomain }> => {
  const res = await api.api["study-domains"].$post({
    json: data,
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "学習領域の作成に失敗しました"))
  }
  const responseData = await res.json()
  return studyDomainSingleResponseSchema.parse(responseData)
}

export const updateStudyDomain = async (
  id: string,
  data: UpdateStudyDomainInput
): Promise<{ studyDomain: StudyDomain }> => {
  const res = await api.api["study-domains"][":id"].$patch({
    param: { id },
    json: data,
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "学習領域の更新に失敗しました"))
  }
  const responseData = await res.json()
  return studyDomainSingleResponseSchema.parse(responseData)
}

export const deleteStudyDomain = async (id: string): Promise<void> => {
  const res = await api.api["study-domains"][":id"].$delete({
    param: { id },
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "学習領域の削除に失敗しました"))
  }
}

export const bulkImportCSV = async (
  studyDomainId: string,
  csvContent: string
): Promise<BulkCSVImportResult> => {
  const res = await api.api["study-domains"][":id"]["import-csv"].$post({
    param: { id: studyDomainId },
    json: { csvContent },
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "CSVインポートに失敗しました"))
  }
  const data = await res.json()
  return bulkCSVImportResponseSchema.parse(data)
}
