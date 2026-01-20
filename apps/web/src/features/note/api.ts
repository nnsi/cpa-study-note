import { api } from "@/lib/api-client"

export const getNotesByTopic = async (topicId: string) => {
  const res = await api.api.notes.topic[":topicId"].$get({
    param: { topicId },
  })
  if (!res.ok) throw new Error("Failed to fetch notes")
  return res.json()
}

export const createNote = async (sessionId: string) => {
  const res = await api.api.notes.$post({
    json: { sessionId },
  })
  if (!res.ok) throw new Error("Failed to create note")
  return res.json()
}
