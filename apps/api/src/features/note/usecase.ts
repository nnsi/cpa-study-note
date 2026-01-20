import type { NoteRepository } from "./repository"
import type { ChatRepository } from "../chat/repository"
import type { AIAdapter } from "@/shared/lib/ai"

type NoteDeps = {
  noteRepo: NoteRepository
  chatRepo: ChatRepository
  aiAdapter: AIAdapter
}

type NoteResponse = {
  id: string
  userId: string
  topicId: string
  sessionId: string
  aiSummary: string
  userMemo: string | null
  keyPoints: string[]
  stumbledPoints: string[]
  createdAt: string
  updatedAt: string
}

type CreateNoteInput = {
  userId: string
  sessionId: string
}

type UpdateNoteInput = {
  userMemo?: string
  keyPoints?: string[]
  stumbledPoints?: string[]
}

// ノートをレスポンス形式に変換
const toNoteResponse = (note: {
  id: string
  userId: string
  topicId: string
  sessionId: string
  aiSummary: string
  userMemo: string | null
  keyPoints: string[]
  stumbledPoints: string[]
  createdAt: Date
  updatedAt: Date
}): NoteResponse => ({
  ...note,
  createdAt: note.createdAt.toISOString(),
  updatedAt: note.updatedAt.toISOString(),
})

// セッションからノート作成（AI要約生成）
export const createNoteFromSession = async (
  deps: NoteDeps,
  input: CreateNoteInput
): Promise<
  { ok: true; note: NoteResponse } | { ok: false; error: string; status: number }
> => {
  const { noteRepo, chatRepo, aiAdapter } = deps
  const { userId, sessionId } = input

  const session = await chatRepo.findSessionById(sessionId)
  if (!session) {
    return { ok: false, error: "Session not found", status: 404 }
  }

  if (session.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  const messages = await chatRepo.findMessagesBySession(sessionId)

  // AI要約生成
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`)
    .join("\n\n")

  const summaryPrompt = `以下のチャット履歴を要約し、学習ノートを作成してください。

チャット履歴:
${conversationText}

以下の形式でJSON形式で回答してください:
{
  "summary": "全体の要約（2-3文）",
  "keyPoints": ["重要ポイント1", "重要ポイント2", ...],
  "stumbledPoints": ["つまずいたポイント1", ...]
}`

  const result = await aiAdapter.generateText({
    model: "deepseek/deepseek-chat",
    messages: [{ role: "user", content: summaryPrompt }],
    temperature: 0.3,
    maxTokens: 1000,
  })

  let aiSummary = ""
  let keyPoints: string[] = []
  let stumbledPoints: string[] = []

  try {
    const parsed = JSON.parse(result.content)
    aiSummary = parsed.summary || ""
    keyPoints = parsed.keyPoints || []
    stumbledPoints = parsed.stumbledPoints || []
  } catch {
    aiSummary = result.content
  }

  const note = await noteRepo.create({
    userId,
    topicId: session.topicId,
    sessionId,
    aiSummary,
    userMemo: null,
    keyPoints,
    stumbledPoints,
  })

  return { ok: true, note: toNoteResponse(note) }
}

// ノート一覧取得
export const listNotes = async (
  deps: Pick<NoteDeps, "noteRepo">,
  userId: string
): Promise<NoteResponse[]> => {
  const notes = await deps.noteRepo.findByUser(userId)
  return notes.map(toNoteResponse)
}

// 論点別ノート一覧取得
export const listNotesByTopic = async (
  deps: Pick<NoteDeps, "noteRepo">,
  userId: string,
  topicId: string
): Promise<NoteResponse[]> => {
  const notes = await deps.noteRepo.findByTopic(userId, topicId)
  return notes.map(toNoteResponse)
}

// ノート詳細取得
export const getNote = async (
  deps: Pick<NoteDeps, "noteRepo">,
  userId: string,
  noteId: string
): Promise<
  { ok: true; note: NoteResponse } | { ok: false; error: string; status: number }
> => {
  const note = await deps.noteRepo.findById(noteId)

  if (!note) {
    return { ok: false, error: "Note not found", status: 404 }
  }

  if (note.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  return { ok: true, note: toNoteResponse(note) }
}

// ノート更新
export const updateNote = async (
  deps: Pick<NoteDeps, "noteRepo">,
  userId: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<
  { ok: true; note: NoteResponse } | { ok: false; error: string; status: number }
> => {
  const existing = await deps.noteRepo.findById(noteId)

  if (!existing) {
    return { ok: false, error: "Note not found", status: 404 }
  }

  if (existing.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  const note = await deps.noteRepo.update(noteId, input)

  return { ok: true, note: toNoteResponse(note!) }
}
