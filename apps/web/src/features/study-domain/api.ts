import { api } from "@/lib/api-client"

export type StudyDomain = {
  id: string
  name: string
  description: string | null
  emoji: string | null
  color: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export type UserStudyDomain = {
  id: string
  userId: string
  studyDomainId: string
  joinedAt: string
  studyDomain: StudyDomain
}

export const getPublicStudyDomains = async (): Promise<{
  studyDomains: StudyDomain[]
}> => {
  const res = await api.api["study-domains"].$get()
  if (!res.ok) throw new Error("Failed to fetch public study domains")
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

export const getUserStudyDomains = async (): Promise<{
  userStudyDomains: UserStudyDomain[]
}> => {
  const res = await api.api.me["study-domains"].$get()
  if (!res.ok) throw new Error("Failed to fetch user study domains")
  return res.json()
}

export const joinStudyDomain = async (
  id: string
): Promise<{ userStudyDomain: UserStudyDomain }> => {
  const res = await api.api.me["study-domains"][":id"].join.$post({
    param: { id },
  })
  if (!res.ok) throw new Error("Failed to join study domain")
  return res.json()
}

export const leaveStudyDomain = async (
  id: string
): Promise<{ success: boolean }> => {
  const res = await api.api.me["study-domains"][":id"].leave.$delete({
    param: { id },
  })
  if (!res.ok) throw new Error("Failed to leave study domain")
  return res.json()
}
