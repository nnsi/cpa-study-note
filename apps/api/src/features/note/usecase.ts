import type { NoteRepository } from "./repository"
import type { ChatRepository } from "../chat/repository"
import type { SubjectRepository } from "../subject/repository"
import type { AIAdapter, AIModelConfig } from "@/shared/lib/ai"
import type { NoteSource } from "@cpa-study/shared/schemas"
import { parseLLMJson, stripCodeBlock } from "@cpa-study/shared"
import { z } from "zod"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, forbidden, badRequest, internalError, type AppError } from "@/shared/lib/errors"

type NoteDeps = {
  noteRepo: NoteRepository
  chatRepo: ChatRepository
  aiAdapter: AIAdapter
  noteSummaryConfig: AIModelConfig
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
): Promise<Result<NoteResponse, AppError>> => {
  const { noteRepo, chatRepo, aiAdapter, noteSummaryConfig } = deps
  const { userId, sessionId } = input

  const session = await chatRepo.findSessionById(sessionId)
  if (!session) {
    return err(notFound("セッションが見つかりません"))
  }

  if (session.userId !== userId) {
    return err(forbidden("このセッションへのアクセス権限がありません"))
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

  let aiResult
  try {
    aiResult = await aiAdapter.generateText({
      model: noteSummaryConfig.model,
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: noteSummaryConfig.temperature,
      maxTokens: noteSummaryConfig.maxTokens,
    })
  } catch (error) {
    console.error("[AI] generateText error:", error)
    return err(internalError("AI要約の生成に失敗しました。再度お試しください。"))
  }

  const noteSummarySchema = z.object({
    summary: z.string().default(""),
    keyPoints: z.array(z.string()).default([]),
    stumbledPoints: z.array(z.string()).default([]),
  })

  // パース失敗時のフォールバック: コードブロック除去後の生テキストをaiSummaryに設定
  const fallbackSummary = {
    summary: stripCodeBlock(aiResult.content),
    keyPoints: [] as string[],
    stumbledPoints: [] as string[],
  }

  const parsed = parseLLMJson(aiResult.content, noteSummarySchema, fallbackSummary)
  const aiSummary = parsed.summary
  const keyPoints = parsed.keyPoints
  const stumbledPoints = parsed.stumbledPoints

  const note = await noteRepo.create({
    userId,
    topicId: session.topicId,
    sessionId,
    aiSummary,
    userMemo: null,
    keyPoints,
    stumbledPoints,
  })

  return ok(toNoteResponse(note))
}

// 独立ノート作成（手動）
export const createManualNote = async (
  deps: { noteRepo: NoteRepository; subjectRepo: SubjectRepository },
  input: CreateManualNoteInput
): Promise<Result<NoteResponse, AppError>> => {
  const { noteRepo, subjectRepo } = deps
  const { userId, topicId, userMemo, keyPoints = [], stumbledPoints = [] } = input

  // topicの存在確認
  const topic = await subjectRepo.findTopicById(topicId, userId)
  if (!topic) {
    return err(notFound("論点が見つかりません"))
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

  return ok(toNoteResponse(note))
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
): Promise<Result<NoteDetailResponse, AppError>> => {
  const note = await deps.noteRepo.findByIdWithTopic(noteId)

  if (!note) {
    return err(notFound("ノートが見つかりません"))
  }

  if (note.userId !== userId) {
    return err(forbidden("このノートへのアクセス権限がありません"))
  }

  return ok({
    ...toNoteResponse(note),
    topicName: note.topicName,
    categoryId: note.categoryId,
    subjectId: note.subjectId,
    subjectName: note.subjectName,
  })
}

// ノート更新
export const updateNote = async (
  deps: Pick<NoteDeps, "noteRepo">,
  userId: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<Result<NoteResponse, AppError>> => {
  const existing = await deps.noteRepo.findById(noteId)

  if (!existing) {
    return err(notFound("ノートが見つかりません"))
  }

  if (existing.userId !== userId) {
    return err(forbidden("このノートへのアクセス権限がありません"))
  }

  const note = await deps.noteRepo.update(noteId, input)

  return ok(toNoteResponse(note!))
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
): Promise<Result<NoteResponse, AppError>> => {
  const { noteRepo, chatRepo, aiAdapter, noteSummaryConfig } = deps

  const existing = await noteRepo.findById(noteId)
  if (!existing) {
    return err(notFound("ノートが見つかりません"))
  }

  if (existing.userId !== userId) {
    return err(forbidden("このノートへのアクセス権限がありません"))
  }

  if (!existing.sessionId) {
    return err(badRequest("このノートにはセッションが紐づいていません"))
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

  let aiResult
  try {
    aiResult = await aiAdapter.generateText({
      model: noteSummaryConfig.model,
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: noteSummaryConfig.temperature,
      maxTokens: noteSummaryConfig.maxTokens,
    })
  } catch (error) {
    console.error("[AI] generateText error:", error)
    return err(internalError("AI要約の生成に失敗しました。再度お試しください。"))
  }

  const noteSummarySchema = z.object({
    summary: z.string().default(""),
    keyPoints: z.array(z.string()).default([]),
    stumbledPoints: z.array(z.string()).default([]),
  })

  // パース失敗時のフォールバック: コードブロック除去後の生テキストをaiSummaryに設定
  const fallbackSummary = {
    summary: stripCodeBlock(aiResult.content),
    keyPoints: [] as string[],
    stumbledPoints: [] as string[],
  }

  const parsed = parseLLMJson(aiResult.content, noteSummarySchema, fallbackSummary)
  const aiSummary = parsed.summary
  const keyPoints = parsed.keyPoints
  const stumbledPoints = parsed.stumbledPoints

  const note = await noteRepo.update(noteId, {
    aiSummary,
    keyPoints,
    stumbledPoints,
  })

  return ok(toNoteResponse(note!))
}
