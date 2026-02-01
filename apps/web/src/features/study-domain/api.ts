import { api } from "@/lib/api-client"

export type StudyDomain = {
  id: string
  userId: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  createdAt: string
  updatedAt: string
}

export type CreateStudyDomainInput = {
  name: string
  description?: string
  emoji?: string
  color?: string
}

export type UpdateStudyDomainInput = {
  name?: string
  description?: string
  emoji?: string
  color?: string
}

export const getStudyDomains = async (): Promise<{
  studyDomains: StudyDomain[]
}> => {
  const res = await api.api["study-domains"].$get()
  if (!res.ok) throw new Error("Failed to fetch study domains")
  return res.json()
}

export const getStudyDomain = async (
  id: string
): Promise<{ studyDomain: StudyDomain }> => {
  const res = await api.api["study-domains"][":id"].$get({
    param: { id },
  })
  if (!res.ok) throw new Error("Failed to fetch study domain")
  return res.json()
}

export const createStudyDomain = async (
  data: CreateStudyDomainInput
): Promise<{ studyDomain: StudyDomain }> => {
  const res = await api.api["study-domains"].$post({
    json: data,
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "Failed to create study domain")
  }
  return res.json()
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
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "Failed to update study domain")
  }
  return res.json()
}

export const deleteStudyDomain = async (
  id: string
): Promise<{ success: boolean }> => {
  const res = await api.api["study-domains"][":id"].$delete({
    param: { id },
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: string }).error ?? "Failed to delete study domain")
  }
  return res.json()
}
