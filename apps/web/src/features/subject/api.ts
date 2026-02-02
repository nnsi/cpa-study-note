import { api } from "@/lib/api-client"
import type {
  CreateSubjectRequest,
  UpdateSubjectRequest,
  TopicSearchResult,
} from "@cpa-study/shared/schemas"
import type {
  TopicNodeResponse,
  SubcategoryNodeResponse,
  CategoryNodeResponse,
  TreeResponse,
  TopicNode as TopicNodeInput,
  SubcategoryNode as SubcategoryNodeInput,
  CategoryNode as CategoryNodeInput,
  UpdateTreeRequest,
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

// Subject types - based on actual API response (without userId for list, with userId for single)
export type Subject = {
  id: string
  userId: string
  studyDomainId: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export type SubjectWithStats = {
  id: string
  studyDomainId: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
  categoryCount: number
  topicCount: number
}

// API functions
export const getSubjects = async (domainId: string): Promise<{ subjects: SubjectWithStats[] }> => {
  const res = await api.api.subjects.$get({
    query: { studyDomainId: domainId },
  })
  if (!res.ok) {
    throw new Error("科目の取得に失敗しました")
  }
  return res.json() as Promise<{ subjects: SubjectWithStats[] }>
}

export const getSubject = async (id: string): Promise<{ subject: Subject }> => {
  const res = await api.api.subjects[":id"].$get({
    param: { id },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("科目が見つかりません")
    throw new Error("科目の取得に失敗しました")
  }
  return res.json() as Promise<{ subject: Subject }>
}

export const createSubject = async (
  domainId: string,
  data: CreateSubjectRequest
): Promise<{ subject: Subject }> => {
  const res = await api.api["study-domains"][":domainId"].subjects.$post({
    param: { domainId },
    json: data,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "科目の作成に失敗しました")
  }
  return res.json() as Promise<{ subject: Subject }>
}

export const updateSubject = async (
  id: string,
  data: UpdateSubjectRequest
): Promise<{ subject: Subject }> => {
  const res = await api.api.subjects[":id"].$patch({
    param: { id },
    json: data,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "科目の更新に失敗しました")
  }
  return res.json() as Promise<{ subject: Subject }>
}

export const deleteSubject = async (id: string): Promise<{ success: boolean }> => {
  const res = await api.api.subjects[":id"].$delete({
    param: { id },
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "科目の削除に失敗しました")
  }
  return res.json() as Promise<{ success: boolean }>
}

export const getSubjectTree = async (id: string): Promise<{ tree: TreeResponse }> => {
  const res = await api.api.subjects[":id"].tree.$get({
    param: { id },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("科目が見つかりません")
    throw new Error("ツリーの取得に失敗しました")
  }
  return res.json() as Promise<{ tree: TreeResponse }>
}

export const updateSubjectTree = async (
  id: string,
  tree: UpdateTreeRequest
): Promise<{ tree: TreeResponse }> => {
  const res = await api.api.subjects[":id"].tree.$put({
    param: { id },
    json: tree,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "ツリーの更新に失敗しました")
  }
  return res.json() as Promise<{ tree: TreeResponse }>
}

export const importCSV = async (
  id: string,
  csvContent: string
): Promise<{
  success: boolean
  imported: { categories: number; subcategories: number; topics: number }
  errors: Array<{ line: number; message: string }>
}> => {
  const res = await api.api.subjects[":id"].import.$post({
    param: { id },
    json: { csvContent },
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "CSVインポートに失敗しました")
  }
  return res.json() as Promise<{
    success: boolean
    imported: { categories: number; subcategories: number; topics: number }
    errors: Array<{ line: number; message: string }>
  }>
}

export const searchTopics = async (
  query: string,
  studyDomainId: string,
  limit: number = 20
): Promise<TopicSearchResult[]> => {
  const res = await api.api.subjects.search.$get({
    query: { q: query, limit: String(limit), studyDomainId },
  })
  if (!res.ok) {
    throw new Error("検索に失敗しました")
  }
  const data = await res.json()
  return data.results as TopicSearchResult[]
}
