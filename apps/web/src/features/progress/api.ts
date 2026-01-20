import { api } from "@/lib/api-client"

export const getMyProgress = async () => {
  const res = await api.api.subjects.progress.me.$get()
  if (!res.ok) throw new Error("Failed to fetch progress")
  return res.json()
}

export const getSubjects = async () => {
  const res = await api.api.subjects.$get()
  if (!res.ok) throw new Error("Failed to fetch subjects")
  return res.json()
}
