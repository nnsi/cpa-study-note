import { api } from "@/lib/api-client"
import type { CreateManualNoteRequest } from "@cpa-study/shared/schemas"

export const getNotesByTopic = async (topicId: string) => {
  const res = await api.api.notes.topic[":topicId"].$get({
    param: { topicId },
  })
  if (!res.ok) throw new Error("Failed to fetch notes")
  return res.json()
}

// セッションからノート作成
export const createNote = async (sessionId: string) => {
  const res = await api.api.notes.$post({
    json: { sessionId },
  })
  if (!res.ok) throw new Error("Failed to create note")
  return res.json()
}

// 独立ノート作成（手動）
export const createManualNote = async (data: CreateManualNoteRequest) => {
  const res = await api.api.notes.manual.$post({
    json: data,
  })
  if (!res.ok) throw new Error("Failed to create manual note")
  return res.json()
}

export const getNoteBySession = async (sessionId: string) => {
  const res = await api.api.notes.session[":sessionId"].$get({
    param: { sessionId },
  })
  if (!res.ok) throw new Error("Failed to fetch note by session")
  return res.json()
}

export const refreshNote = async (noteId: string) => {
  const res = await api.api.notes[":noteId"].refresh.$post({
    param: { noteId },
  })
  if (!res.ok) throw new Error("Failed to refresh note")
  return res.json()
}
