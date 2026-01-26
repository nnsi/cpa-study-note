import type { NoteRepository } from "./repository"
import type { ChatRepository } from "../chat/repository"
import type { TopicRepository } from "../topic/repository"
import type { AIAdapter } from "@/shared/lib/ai"
import type { NoteSource } from "@cpa-study/shared/schemas"

type NoteDeps = {
  noteRepo: NoteRepository
  chatRepo: ChatRepository
  aiAdapter: AIAdapter
}

type NoteResponse = {
  id: string
  userId: string
  topicId: string
  sessionId: string | null
  aiSummary: string | null
  userMemo: string | null
  keyPoints: string[]
  stumbledPoints: string[]
  createdAt: string
  updatedAt: string
  source: NoteSource
}

type NoteDetailResponse = NoteResponse & {
  topicName: string
  categoryId: string
  subjectId: string
  subjectName: string
}

type NoteListResponse = NoteResponse & {
  topicName: string
  subjectName: string
}

type CreateNoteFromSessionInput = {
  userId: string
  sessionId: string
}

type CreateManualNoteInput = {
  userId: string
  topicId: string
  userMemo: string
  keyPoints?: string[]
  stumbledPoints?: string[]
}

type UpdateNoteInput = {
  userMemo?: string
  keyPoints?: string[]
  stumbledPoints?: string[]
}

// sessionIdの有無からsourceを判定
const deriveSource = (sessionId: string | null): NoteSource =>
  sessionId ? "chat" : "manual"

// ノートをレスポンス形式に変換
const toNoteResponse = (note: {
  id: string
  userId: string
  topicId: string
  sessionId: string | null
  aiSummary: string | null
  userMemo: string | null
  keyPoints: string[]
  stumbledPoints: string[]
  createdAt: Date
  updatedAt: Date
}): NoteResponse => ({
  ...note,
  createdAt: note.createdAt.toISOString(),
  updatedAt: note.updatedAt.toISOString(),
  source: deriveSource(note.sessionId),
})

// セッションからノート作成（AI要約生成）
export const createNoteFromSession = async (
  deps: NoteDeps,
  input: CreateNoteFromSessionInput
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

  // 良質な質問（深掘り質問）を抽出
  const goodQuestions = messages
    .filter((m) => m.role === "user" && m.questionQuality === "good")
    .map((m) => m.content)

  // AI要約生成
  const conversationText = messages
    .map((m) => {
      const prefix = m.role === "user" ? "ユーザー" : "AI"
      const qualityMark = m.role === "user" && m.questionQuality === "good" ? " [深掘り質問]" : ""
      return `${prefix}${qualityMark}: ${m.content}`
    })
    .join("\n\n")

  const goodQuestionsSection = goodQuestions.length > 0
    ? `\n\n## 特に良質な質問（深掘り質問）:\n${goodQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : ""

  const summaryPrompt = `以下のチャット履歴を要約し、学習ノートを作成してください。
[深掘り質問]とマークされた質問は、因果関係を問う質問や仮説を含む質問など、学習において特に価値のある質問です。
これらの質問とその回答を優先的にキーポイントに反映してください。

チャット履歴:
${conversationText}${goodQuestionsSection}

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
    // Markdownコードブロック (```json ... ```) を除去
    let jsonContent = result.content.trim()
    const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1].trim()
    }

    const parsed = JSON.parse(jsonContent)
    aiSummary = parsed.summary || ""
    keyPoints = parsed.keyPoints || []
    stumbledPoints = parsed.stumbledPoints || []
  } catch {
    // パース失敗時はコードブロックを除去した上でそのまま保存
    let fallback = result.content.trim()
    const match = fallback.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      fallback = match[1].trim()
    }
    aiSummary = fallback
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

// 独立ノート作成（手動）
export const createManualNote = async (
  deps: { noteRepo: NoteRepository; topicRepo: TopicRepository },
  input: CreateManualNoteInput
): Promise<
  { ok: true; note: NoteResponse } | { ok: false; error: string; status: number }
> => {
  const { noteRepo, topicRepo } = deps
  const { userId, topicId, userMemo, keyPoints = [], stumbledPoints = [] } = input

  // topicの存在確認
  const topic = await topicRepo.findTopicById(topicId)
  if (!topic) {
    return { ok: false, error: "Topic not found", status: 404 }
  }

  // ノート作成
  const note = await noteRepo.create({
    userId,
    topicId,
    sessionId: null,
    aiSummary: null,
    userMemo,
    keyPoints,
    stumbledPoints,
  })

  return { ok: true, note: toNoteResponse(note) }
}

// ノート一覧取得
export const listNotes = async (
  deps: Pick<NoteDeps, "noteRepo">,
  userId: string
): Promise<NoteListResponse[]> => {
  const notes = await deps.noteRepo.findByUser(userId)
  return notes.map((note) => ({
    ...toNoteResponse(note),
    topicName: note.topicName,
    subjectName: note.subjectName,
  }))
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
  { ok: true; note: NoteDetailResponse } | { ok: false; error: string; status: number }
> => {
  const note = await deps.noteRepo.findByIdWithTopic(noteId)

  if (!note) {
    return { ok: false, error: "Note not found", status: 404 }
  }

  if (note.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  return {
    ok: true,
    note: {
      ...toNoteResponse(note),
      topicName: note.topicName,
      categoryId: note.categoryId,
      subjectId: note.subjectId,
      subjectName: note.subjectName,
    },
  }
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

// セッションIDからノート取得
export const getNoteBySession = async (
  deps: Pick<NoteDeps, "noteRepo">,
  userId: string,
  sessionId: string
): Promise<NoteResponse | null> => {
  const note = await deps.noteRepo.findBySessionId(sessionId)

  if (!note || note.userId !== userId) {
    return null
  }

  return toNoteResponse(note)
}

// ノート再生成（最新の会話を反映）
export const refreshNoteFromSession = async (
  deps: NoteDeps,
  userId: string,
  noteId: string
): Promise<
  { ok: true; note: NoteResponse } | { ok: false; error: string; status: number }
> => {
  const { noteRepo, chatRepo, aiAdapter } = deps

  const existing = await noteRepo.findById(noteId)
  if (!existing) {
    return { ok: false, error: "Note not found", status: 404 }
  }

  if (existing.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  if (!existing.sessionId) {
    return { ok: false, error: "No session linked to this note", status: 400 }
  }

  const messages = await chatRepo.findMessagesBySession(existing.sessionId)

  // 良質な質問（深掘り質問）を抽出
  const goodQuestions = messages
    .filter((m) => m.role === "user" && m.questionQuality === "good")
    .map((m) => m.content)

  // AI要約再生成
  const conversationText = messages
    .map((m) => {
      const prefix = m.role === "user" ? "ユーザー" : "AI"
      const qualityMark = m.role === "user" && m.questionQuality === "good" ? " [深掘り質問]" : ""
      return `${prefix}${qualityMark}: ${m.content}`
    })
    .join("\n\n")

  const goodQuestionsSection = goodQuestions.length > 0
    ? `\n\n## 特に良質な質問（深掘り質問）:\n${goodQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : ""

  const summaryPrompt = `以下のチャット履歴を要約し、学習ノートを作成してください。
[深掘り質問]とマークされた質問は、因果関係を問う質問や仮説を含む質問など、学習において特に価値のある質問です。
これらの質問とその回答を優先的にキーポイントに反映してください。

チャット履歴:
${conversationText}${goodQuestionsSection}

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
    // Markdownコードブロック (```json ... ```) を除去
    let jsonContent = result.content.trim()
    const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1].trim()
    }

    const parsed = JSON.parse(jsonContent)
    aiSummary = parsed.summary || ""
    keyPoints = parsed.keyPoints || []
    stumbledPoints = parsed.stumbledPoints || []
  } catch {
    let fallback = result.content.trim()
    const match = fallback.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      fallback = match[1].trim()
    }
    aiSummary = fallback
  }

  const note = await noteRepo.update(noteId, {
    aiSummary,
    keyPoints,
    stumbledPoints,
  })

  return { ok: true, note: toNoteResponse(note!) }
}
