import type { AIAdapter, AIMessage, StreamChunk, AIConfig } from "@/shared/lib/ai"
import type { ChatRepository } from "./repository"
import type { LearningRepository } from "../learning/repository"
import { buildSystemPrompt, buildEvaluationPrompt } from "./domain/prompts"
import { parseLLMJson } from "@cpa-study/shared"
import type {
  GoodQuestionResponse,
  ChatSession,
  ChatMessage,
  SessionWithStats,
} from "@cpa-study/shared/schemas"
import { z } from "zod"
import { ok, err, type Result } from "@/shared/lib/result"
import { notFound, forbidden, type AppError } from "@/shared/lib/errors"

export type ChatDeps = {
  chatRepo: ChatRepository
  learningRepo: LearningRepository
  aiAdapter: AIAdapter
  aiConfig: AIConfig
}

// セッション作成
export const createSession = async (
  deps: Pick<ChatDeps, "chatRepo" | "learningRepo">,
  userId: string,
  topicId: string
): Promise<Result<ChatSession, AppError>> => {
  const exists = await deps.learningRepo.verifyTopicExists(userId, topicId)
  if (!exists) {
    return err(notFound("論点が見つかりません"))
  }

  const session = await deps.chatRepo.createSession({
    userId,
    topicId,
  })

  return ok({
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  })
}

// セッション一覧取得（メッセージが1件以上あるセッションのみ）
// N+1問題を解消: 1クエリでセッションと統計を取得
export const listSessionsByTopic = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  topicId: string
): Promise<Result<SessionWithStats[], AppError>> => {
  const sessions = await deps.chatRepo.findSessionsWithStatsByTopic(userId, topicId)

  return ok(
    sessions.map((session) => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }))
  )
}

// セッション取得
export const getSession = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  sessionId: string
): Promise<Result<ChatSession, AppError>> => {
  const session = await deps.chatRepo.findSessionById(sessionId)
  if (!session) {
    return err(notFound("セッションが見つかりません"))
  }

  if (session.userId !== userId) {
    return err(forbidden("このセッションへのアクセス権限がありません"))
  }

  return ok({
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  })
}

// メッセージ一覧取得
export const listMessages = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  sessionId: string
): Promise<Result<ChatMessage[], AppError>> => {
  const session = await deps.chatRepo.findSessionById(sessionId)
  if (!session) {
    return err(notFound("セッションが見つかりません"))
  }

  if (session.userId !== userId) {
    return err(forbidden("このセッションへのアクセス権限がありません"))
  }

  const messages = await deps.chatRepo.findMessagesBySession(sessionId)

  return ok(messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  })))
}

// メッセージ取得（評価用）- 所有権チェック付き
export const getMessageForEvaluation = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  messageId: string
): Promise<Result<string, AppError>> => {
  const message = await deps.chatRepo.findMessageById(messageId)
  if (!message) {
    return err(notFound("メッセージが見つかりません"))
  }

  // セッション経由で所有権を確認
  const session = await deps.chatRepo.findSessionById(message.sessionId)
  if (!session || session.userId !== userId) {
    return err(forbidden("このメッセージへのアクセス権限がありません"))
  }

  return ok(message.content)
}

type SendMessageInput = {
  sessionId: string
  userId: string
  content: string
  imageId?: string
  ocrResult?: string
}

type SendMessageWithNewSessionInput = {
  topicId: string
  userId: string
  content: string
  imageId?: string
  ocrResult?: string
}

export async function* sendMessage(
  deps: ChatDeps,
  input: SendMessageInput
): AsyncIterable<StreamChunk> {
  const session = await deps.chatRepo.findSessionById(input.sessionId)
  if (!session) {
    yield { type: "error", error: "Session not found" }
    return
  }

  if (session.userId !== input.userId) {
    yield { type: "error", error: "Unauthorized" }
    return
  }

  // トピックと階層情報を取得
  const hierarchy = await deps.chatRepo.getTopicWithHierarchy(session.topicId)
  if (!hierarchy) {
    yield { type: "error", error: "Topic not found" }
    return
  }

  // ユーザーメッセージを保存
  const userMessage = await deps.chatRepo.createMessage({
    sessionId: input.sessionId,
    role: "user",
    content: input.content,
    imageId: input.imageId ?? null,
    ocrResult: input.ocrResult ?? null,
    questionQuality: null,
  })

  // 過去のメッセージを取得
  const history = await deps.chatRepo.findMessagesBySession(input.sessionId)

  // AI用メッセージを構築
  const messages: AIMessage[] = []

  // システムプロンプト
  const systemPrompt = buildSystemPrompt({
    studyDomainName: hierarchy.studyDomain.name,
    subjectName: hierarchy.subject.name,
    topicName: hierarchy.topic.name,
    customPrompt: hierarchy.topic.aiSystemPrompt,
  })
  messages.push({ role: "system", content: systemPrompt })

  // 過去のやり取りを追加（最新のユーザーメッセージを除く）
  for (const msg of history.slice(0, -1)) {
    if (msg.role === "user" || msg.role === "assistant") {
      const content = msg.ocrResult
        ? `[画像から抽出されたテキスト]\n${msg.ocrResult}\n\n${msg.content}`
        : msg.content
      messages.push({ role: msg.role as "user" | "assistant", content })
    }
  }

  // 現在のユーザーメッセージ
  const currentContent = input.ocrResult
    ? `[画像から抽出されたテキスト]\n${input.ocrResult}\n\n${input.content}`
    : input.content
  messages.push({ role: "user", content: currentContent })

  // AIからのストリーミングレスポンス
  let fullResponse = ""

  try {
    for await (const chunk of deps.aiAdapter.streamText({
      model: deps.aiConfig.chat.model,
      messages,
      temperature: deps.aiConfig.chat.temperature,
      maxTokens: deps.aiConfig.chat.maxTokens,
    })) {
      if (chunk.type === "text" && chunk.content) {
        fullResponse += chunk.content
        yield chunk
      }
      // "done"チャンクはメッセージ保存後に送信するためここではyieldしない
    }
  } catch (error) {
    console.error("[AI] Stream error:", error)
    yield { type: "error", error: "AI応答中にエラーが発生しました。再度お試しください。" }
    return
  }

  // アシスタントメッセージを保存
  if (fullResponse) {
    await deps.chatRepo.createMessage({
      sessionId: input.sessionId,
      role: "assistant",
      content: fullResponse,
      imageId: null,
      ocrResult: null,
      questionQuality: null,
    })
  }

  // 進捗を更新（learning featureのrepositoryを使用）
  await deps.learningRepo.upsertProgress(input.userId, {
    userId: input.userId,
    topicId: session.topicId,
    incrementQuestionCount: true,
  })

  // メッセージ保存後に"done"を送信（ユーザーメッセージIDを含める）
  yield { type: "done" as const, messageId: userMessage.id }
}

// 新規セッション作成 + メッセージ送信（最初のメッセージ送信時にセッションを作成）
export async function* sendMessageWithNewSession(
  deps: ChatDeps,
  input: SendMessageWithNewSessionInput
): AsyncIterable<StreamChunk & { sessionId?: string }> {
  // トピックと階層情報を取得
  const hierarchy = await deps.chatRepo.getTopicWithHierarchy(input.topicId)
  if (!hierarchy) {
    yield { type: "error", error: "Topic not found" }
    return
  }

  // セッションを作成
  const session = await deps.chatRepo.createSession({
    userId: input.userId,
    topicId: input.topicId,
  })

  // セッションIDを最初に通知
  yield { type: "session_created" as const, sessionId: session.id }

  // ユーザーメッセージを保存
  const userMessage = await deps.chatRepo.createMessage({
    sessionId: session.id,
    role: "user",
    content: input.content,
    imageId: input.imageId ?? null,
    ocrResult: input.ocrResult ?? null,
    questionQuality: null,
  })

  // AI用メッセージを構築
  const messages: AIMessage[] = []

  // システムプロンプト
  const systemPrompt = buildSystemPrompt({
    studyDomainName: hierarchy.studyDomain.name,
    subjectName: hierarchy.subject.name,
    topicName: hierarchy.topic.name,
    customPrompt: hierarchy.topic.aiSystemPrompt,
  })
  messages.push({ role: "system", content: systemPrompt })

  // 現在のユーザーメッセージ
  const currentContent = input.ocrResult
    ? `[画像から抽出されたテキスト]\n${input.ocrResult}\n\n${input.content}`
    : input.content
  messages.push({ role: "user", content: currentContent })

  // AIからのストリーミングレスポンス
  let fullResponse = ""

  try {
    for await (const chunk of deps.aiAdapter.streamText({
      model: deps.aiConfig.chat.model,
      messages,
      temperature: deps.aiConfig.chat.temperature,
      maxTokens: deps.aiConfig.chat.maxTokens,
    })) {
      if (chunk.type === "text" && chunk.content) {
        fullResponse += chunk.content
        yield chunk
      }
    }
  } catch (error) {
    console.error("[AI] Stream error:", error)
    yield { type: "error", error: "AI応答中にエラーが発生しました。再度お試しください。" }
    return
  }

  // アシスタントメッセージを保存
  if (fullResponse) {
    await deps.chatRepo.createMessage({
      sessionId: session.id,
      role: "assistant",
      content: fullResponse,
      imageId: null,
      ocrResult: null,
      questionQuality: null,
    })
  }

  // 進捗を更新（learning featureのrepositoryを使用）
  await deps.learningRepo.upsertProgress(input.userId, {
    userId: input.userId,
    topicId: input.topicId,
    incrementQuestionCount: true,
  })

  // メッセージ保存後に"done"を送信
  yield { type: "done" as const, messageId: userMessage.id }
}

// トピックに紐づくgood質問を一括取得（N+1解消用）
export const listGoodQuestionsByTopic = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  topicId: string
): Promise<Result<GoodQuestionResponse[], AppError>> => {
  const questions = await deps.chatRepo.findGoodQuestionsByTopic(userId, topicId)

  return ok(
    questions.map((q) => ({
      id: q.id,
      sessionId: q.sessionId,
      content: q.content,
      createdAt: q.createdAt.toISOString(),
    }))
  )
}

type QuestionEvaluation = {
  quality: "good" | "surface"
  reason: string
}

export const evaluateQuestion = async (
  deps: ChatDeps,
  messageId: string,
  content: string
): Promise<Result<QuestionEvaluation, AppError>> => {
  const evaluationPrompt = buildEvaluationPrompt(content)

  const result = await deps.aiAdapter.generateText({
    model: deps.aiConfig.evaluation.model,
    messages: [{ role: "user", content: evaluationPrompt }],
    temperature: deps.aiConfig.evaluation.temperature,
    maxTokens: deps.aiConfig.evaluation.maxTokens,
  })

  const evaluationSchema = z.object({
    quality: z.string().default("surface"),
    reason: z.string().default(""),
  })

  const fallback = { quality: "surface", reason: "" }
  const parsed = parseLLMJson(result.content, evaluationSchema, fallback)

  // "good" を含むかどうかで判定
  const quality: "good" | "surface" = parsed.quality
    .toLowerCase()
    .includes("good")
    ? "good"
    : "surface"
  const reason = parsed.reason

  await deps.chatRepo.updateMessageQuality(messageId, quality, reason)

  return ok({ quality, reason })
}
