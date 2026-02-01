import { api } from "@/lib/api-client"

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

export type CreateSubjectInput = {
  name: string
  description?: string
  emoji?: string
  color?: string
}

export type UpdateSubjectInput = {
  name?: string
  description?: string | null
  emoji?: string | null
  color?: string | null
}

// Tree types
export type TopicNode = {
  id: string
  name: string
  description: string | null
  difficulty: "basic" | "intermediate" | "advanced" | null
  topicType: string | null
  aiSystemPrompt: string | null
  displayOrder: number
}

export type CategoryNode = {
  id: string
  name: string
  displayOrder: number
  topics: TopicNode[]
}

export type TreeResponse = {
  categories: CategoryNode[]
}

// Input types for tree update (nullable IDs for new nodes)
export type TopicNodeInput = {
  id: string | null
  name: string
  description?: string | null
  difficulty?: "basic" | "intermediate" | "advanced" | null
  topicType?: string | null
  aiSystemPrompt?: string | null
  displayOrder: number
}

export type CategoryNodeInput = {
  id: string | null
  name: string
  displayOrder: number
  topics: TopicNodeInput[]
}

export type UpdateTreeInput = {
  categories: CategoryNodeInput[]
}

// API functions
export const getSubjects = async (domainId: string): Promise<{ subjects: Subject[] }> => {
  const res = await api.api["study-domains"][":domainId"].subjects.$get({
    param: { domainId },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("学習領域が見つかりません")
    throw new Error("科目の取得に失敗しました")
  }
  return res.json()
}

export const getSubject = async (id: string): Promise<{ subject: Subject }> => {
  const res = await api.api.subjects[":id"].$get({
    param: { id },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("科目が見つかりません")
    throw new Error("科目の取得に失敗しました")
  }
  return res.json()
}

export const createSubject = async (
  domainId: string,
  data: CreateSubjectInput
): Promise<{ subject: Subject }> => {
  const res = await api.api["study-domains"][":domainId"].subjects.$post({
    param: { domainId },
    json: data,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "科目の作成に失敗しました")
  }
  return res.json()
}

export const updateSubject = async (
  id: string,
  data: UpdateSubjectInput
): Promise<{ subject: Subject }> => {
  const res = await api.api.subjects[":id"].$patch({
    param: { id },
    json: data,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "科目の更新に失敗しました")
  }
  return res.json()
}

export const deleteSubject = async (id: string): Promise<{ success: boolean }> => {
  const res = await api.api.subjects[":id"].$delete({
    param: { id },
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "科目の削除に失敗しました")
  }
  return res.json()
}

export const getSubjectTree = async (id: string): Promise<{ tree: TreeResponse }> => {
  const res = await api.api.subjects[":id"].tree.$get({
    param: { id },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error("科目が見つかりません")
    throw new Error("ツリーの取得に失敗しました")
  }
  return res.json()
}

export const updateSubjectTree = async (
  id: string,
  tree: UpdateTreeInput
): Promise<{ tree: TreeResponse }> => {
  const res = await api.api.subjects[":id"].tree.$put({
    param: { id },
    json: tree,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "ツリーの更新に失敗しました")
  }
  return res.json()
}

export const importCSV = async (
  id: string,
  csvContent: string
): Promise<{
  success: boolean
  imported: { categories: number; topics: number }
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
  return res.json()
}

// Search types
export type TopicSearchResult = {
  id: string
  name: string
  description: string | null
  categoryId: string
  categoryName: string
  subjectId: string
  subjectName: string
  studyDomainId: string
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
  return data.results
}
