import { api } from "@/lib/api-client"
import {
  type CreateManualNoteRequest,
  type SuccessResponse,
  noteSingleResponseSchema,
  notesListResponseSchema,
  notesFullListResponseSchema,
  noteBySessionResponseSchema,
  noteCreateResponseSchema,
  successResponseSchema,
} from "@cpa-study/shared/schemas"

// 全ノート一覧取得
export const getNotes = async () => {
  const res = await api.api.notes.$get()
  if (!res.ok) throw new Error("Failed to fetch notes")
  const data = await res.json()
  return notesFullListResponseSchema.parse(data)
}

export const getNotesByTopic = async (topicId: string) => {
  const res = await api.api.notes.topic[":topicId"].$get({
    param: { topicId },
  })
  if (!res.ok) throw new Error("Failed to fetch notes")
  const data = await res.json()
  return notesListResponseSchema.parse(data)
}

// セッションからノート作成
export const createNote = async (sessionId: string) => {
  const res = await api.api.notes.$post({
    json: { sessionId },
  })
  if (!res.ok) throw new Error("Failed to create note")
  const data = await res.json()
  return noteCreateResponseSchema.parse(data)
}

// 独立ノート作成（手動）
export const createManualNote = async (data: CreateManualNoteRequest) => {
  const res = await api.api.notes.manual.$post({
    json: data,
  })
  if (!res.ok) throw new Error("Failed to create manual note")
  const json = await res.json()
  return noteSingleResponseSchema.parse(json)
}

export const getNoteBySession = async (sessionId: string) => {
  const res = await api.api.notes.session[":sessionId"].$get({
    param: { sessionId },
  })
  if (!res.ok) throw new Error("Failed to fetch note by session")
  const data = await res.json()
  return noteBySessionResponseSchema.parse(data)
}

export const refreshNote = async (noteId: string) => {
  const res = await api.api.notes[":noteId"].refresh.$post({
    param: { noteId },
  })
  if (!res.ok) throw new Error("Failed to refresh note")
  return res.json()
}

// ノート削除
export const deleteNote = async (noteId: string): Promise<SuccessResponse> => {
  const res = await api.api.notes[":noteId"].$delete({
    param: { noteId },
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error((error as { error?: { message?: string } }).error?.message ?? "ノートの削除に失敗しました")
  }
  const json = await res.json()
  return successResponseSchema.parse(json)
}
