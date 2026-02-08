import { api, extractErrorMessage } from "@/lib/api-client"
import {
  searchTopicsResponseSchema,
  subjectsWithStatsListResponseSchema,
  subjectDetailResponseSchema,
  successResponseSchema,
  treeDetailResponseSchema,
  csvImportResponseSchema,
  type CreateSubjectRequest,
  type UpdateSubjectRequest,
  type TopicSearchResult,
  type SubjectResponse,
  type SubjectWithStats,
  type TopicNodeResponse,
  type SubcategoryNodeResponse,
  type CategoryNodeResponse,
  type TreeResponse,
  type TopicNode as TopicNodeInput,
  type SubcategoryNode as SubcategoryNodeInput,
  type CategoryNode as CategoryNodeInput,
  type UpdateTreeRequest,
  type SubjectsWithStatsListResponse,
  type SubjectDetailResponse,
  type SuccessResponse,
  type TreeDetailResponse,
  type CSVImportResponse,
} from "@cpa-study/shared/schemas"

// Re-export tree response types with convenient names (used by TreeEditor, useTreeState, etc.)
export type TopicNode = TopicNodeResponse
export type SubcategoryNode = SubcategoryNodeResponse
export type CategoryNode = CategoryNodeResponse
export type { TreeResponse }

// Re-export tree input types (for creating/updating)
export type { TopicNodeInput, SubcategoryNodeInput, CategoryNodeInput }
export type UpdateTreeInput = UpdateTreeRequest

// Re-export request types
export type CreateSubjectInput = CreateSubjectRequest
export type UpdateSubjectInput = UpdateSubjectRequest

// Re-export search result type
export type { TopicSearchResult }

// Re-export subject types from shared schema
export type Subject = SubjectResponse
export type { SubjectWithStats }

// API functions
export const getSubjects = async (domainId: string): Promise<SubjectsWithStatsListResponse> => {
  const res = await api.api.subjects.$get({
    query: { studyDomainId: domainId },
  })
  if (!res.ok) {
    throw new Error("科目の取得に失敗しました")
  }
  const json = await res.json()
  return subjectsWithStatsListResponseSchema.parse(json)
}

export const getSubject = async (id: string): Promise<SubjectDetailResponse> => {
  const res = await api.api.subjects[":id"].$get({
    param: { id },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("科目が見つかりません")
    throw new Error("科目の取得に失敗しました")
  }
  const json = await res.json()
  return subjectDetailResponseSchema.parse(json)
}

export const createSubject = async (
  domainId: string,
  data: CreateSubjectRequest
): Promise<SubjectDetailResponse> => {
  const res = await api.api.subjects["study-domains"][":domainId"].$post({
    param: { domainId },
    json: data,
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "科目の作成に失敗しました"))
  }
  const json = await res.json()
  return subjectDetailResponseSchema.parse(json)
}

export const updateSubject = async (
  id: string,
  data: UpdateSubjectRequest
): Promise<SubjectDetailResponse> => {
  const res = await api.api.subjects[":id"].$patch({
    param: { id },
    json: data,
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "科目の更新に失敗しました"))
  }
  const json = await res.json()
  return subjectDetailResponseSchema.parse(json)
}

export const deleteSubject = async (id: string): Promise<SuccessResponse> => {
  const res = await api.api.subjects[":id"].$delete({
    param: { id },
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "科目の削除に失敗しました"))
  }
  const json = await res.json()
  return successResponseSchema.parse(json)
}

export const getSubjectTree = async (id: string): Promise<TreeDetailResponse> => {
  const res = await api.api.subjects[":id"].tree.$get({
    param: { id },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("科目が見つかりません")
    throw new Error("ツリーの取得に失敗しました")
  }
  const json = await res.json()
  return treeDetailResponseSchema.parse(json)
}

export const updateSubjectTree = async (
  id: string,
  tree: UpdateTreeRequest
): Promise<TreeDetailResponse> => {
  const res = await api.api.subjects[":id"].tree.$put({
    param: { id },
    json: tree,
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "ツリーの更新に失敗しました"))
  }
  const json = await res.json()
  return treeDetailResponseSchema.parse(json)
}

export const importCSV = async (
  id: string,
  csvContent: string
): Promise<CSVImportResponse> => {
  const res = await api.api.subjects[":id"].import.$post({
    param: { id },
    json: { csvContent },
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "CSVインポートに失敗しました"))
  }
  const json = await res.json()
  return csvImportResponseSchema.parse(json)
}

export const searchTopics = async (
  query: string,
  studyDomainId: string,
  limit: number = 20
): Promise<TopicSearchResult[]> => {
  const res = await api.api.view.search.$get({
    query: { q: query, limit: String(limit), studyDomainId },
  })
  if (!res.ok) {
    throw new Error("検索に失敗しました")
  }
  const json = await res.json()
  const data = searchTopicsResponseSchema.parse(json)
  // Transform to TopicSearchResult format (topic.ts schema has extra fields)
  return data.results.map((r) => ({
    id: r.id,
    name: r.name,
    description: null,
    studyDomainId,
    subjectId: r.subjectId,
    categoryId: r.categoryId,
    subjectName: r.subjectName,
    categoryName: r.categoryName,
  }))
}
