import { api, extractErrorMessage } from "@/lib/api-client"
import {
  type CreateManualNoteRequest,
  noteSingleResponseSchema,
  notesListResponseSchema,
  notesFullListResponseSchema,
  noteBySessionResponseSchema,
  noteCreateResponseSchema,
} from "@cpa-study/shared/schemas"

// 全ノート一覧取得
export const getNotes = async () => {
  const res = await api.api.notes.$get()
  if (!res.ok) throw new Error("ノートの取得に失敗しました")
  const data = await res.json()
  return notesFullListResponseSchema.parse(data)
}

export const getNotesByTopic = async (topicId: string) => {
  const res = await api.api.notes.topic[":topicId"].$get({
    param: { topicId },
  })
  if (!res.ok) throw new Error("ノートの取得に失敗しました")
  const data = await res.json()
  return notesListResponseSchema.parse(data)
}

// セッションからノート作成
export const createNote = async (sessionId: string) => {
  const res = await api.api.notes.$post({
    json: { sessionId },
  })
  if (!res.ok) throw new Error("ノートの作成に失敗しました")
  const data = await res.json()
  return noteCreateResponseSchema.parse(data)
}

// 独立ノート作成（手動）
export const createManualNote = async (data: CreateManualNoteRequest) => {
  const res = await api.api.notes.manual.$post({
    json: data,
  })
  if (!res.ok) throw new Error("ノートの作成に失敗しました")
  const json = await res.json()
  return noteSingleResponseSchema.parse(json)
}

export const getNoteBySession = async (sessionId: string) => {
  const res = await api.api.notes.session[":sessionId"].$get({
    param: { sessionId },
  })
  if (!res.ok) throw new Error("セッションのノートの取得に失敗しました")
  const data = await res.json()
  return noteBySessionResponseSchema.parse(data)
}

export const refreshNote = async (noteId: string) => {
  const res = await api.api.notes[":noteId"].refresh.$post({
    param: { noteId },
  })
  if (!res.ok) throw new Error("ノートの更新に失敗しました")
  return res.json()
}

// ノート詳細取得
export const getNoteDetail = async (noteId: string) => {
  const res = await api.api.notes[":noteId"].$get({
    param: { noteId },
  })
  if (!res.ok) throw new Error(`ノートの取得に失敗しました (${res.status})`)
  const json = await res.json()
  return noteSingleResponseSchema.parse(json)
}

// ノート詳細更新
export const updateNoteDetail = async (
  noteId: string,
  updates: { userMemo?: string; keyPoints?: string[]; stumbledPoints?: string[] }
) => {
  const res = await api.api.notes[":noteId"].$put({
    param: { noteId },
    json: updates,
  })
  if (!res.ok) throw new Error(`ノートの更新に失敗しました (${res.status})`)
  return res.json()
}

// ノート削除
export const deleteNote = async (noteId: string): Promise<void> => {
  const res = await api.api.notes[":noteId"].$delete({
    param: { noteId },
  })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "ノートの削除に失敗しました"))
  }
}
