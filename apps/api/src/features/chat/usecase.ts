import type { AIAdapter, AIMessage, StreamChunk } from "@/shared/lib/ai"
import type { ChatRepository, ChatMessage } from "./repository"
import type { TopicRepository } from "../topic/repository"
import type { AIConfig } from "./domain/ai-config"
import { buildSystemPrompt, buildEvaluationPrompt } from "./domain/prompts"

type ChatDeps = {
  chatRepo: ChatRepository
  topicRepo: TopicRepository
  aiAdapter: AIAdapter
  aiConfig: AIConfig
}

type SessionResponse = {
  id: string
  userId: string
  topicId: string
  createdAt: string
  updatedAt: string
}

type MessageResponse = {
  id: string
  sessionId: string
  role: string
  content: string
  imageId: string | null
  ocrResult: string | null
  questionQuality: string | null
  createdAt: string
}

// セッション作成
export const createSession = async (
  deps: Pick<ChatDeps, "chatRepo" | "topicRepo">,
  userId: string,
  topicId: string
): Promise<
  { ok: true; session: SessionResponse } | { ok: false; error: string; status: number }
> => {
  const topic = await deps.topicRepo.findTopicById(topicId)
  if (!topic) {
    return { ok: false, error: "Topic not found", status: 404 }
  }

  const session = await deps.chatRepo.createSession({
    userId,
    topicId,
  })

  return {
    ok: true,
    session: {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  }
}

type SessionWithStats = SessionResponse & {
  messageCount: number
  goodCount: number
  surfaceCount: number
  firstMessagePreview: string | null
}

// セッション一覧取得（メッセージが1件以上あるセッションのみ）
// N+1問題を解消: 1クエリでセッションと統計を取得
export const listSessionsByTopic = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  topicId: string
): Promise<SessionWithStats[]> => {
  const sessions = await deps.chatRepo.findSessionsWithStatsByTopic(userId, topicId)

  return sessions.map((session) => ({
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }))
}

// セッション取得
export const getSession = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  sessionId: string
): Promise<
  { ok: true; session: SessionResponse } | { ok: false; error: string; status: number }
> => {
  const session = await deps.chatRepo.findSessionById(sessionId)
  if (!session) {
    return { ok: false, error: "Session not found", status: 404 }
  }

  if (session.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  return {
    ok: true,
    session: {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  }
}

// メッセージ一覧取得
export const listMessages = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  sessionId: string
): Promise<
  { ok: true; messages: MessageResponse[] } | { ok: false; error: string; status: number }
> => {
  const session = await deps.chatRepo.findSessionById(sessionId)
  if (!session) {
    return { ok: false, error: "Session not found", status: 404 }
  }

  if (session.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  const messages = await deps.chatRepo.findMessagesBySession(sessionId)

  return {
    ok: true,
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  }
}

// メッセージ取得（評価用）- 所有権チェック付き
export const getMessageForEvaluation = async (
  deps: Pick<ChatDeps, "chatRepo">,
  userId: string,
  messageId: string
): Promise<
  { ok: true; content: string } | { ok: false; error: string; status: number }
> => {
  const message = await deps.chatRepo.findMessageById(messageId)
  if (!message) {
    return { ok: false, error: "Message not found", status: 404 }
  }

  // セッション経由で所有権を確認
  const session = await deps.chatRepo.findSessionById(message.sessionId)
  if (!session || session.userId !== userId) {
    return { ok: false, error: "Forbidden", status: 403 }
  }

  return { ok: true, content: message.content }
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

  const topic = await deps.topicRepo.findTopicById(session.topicId)
  if (!topic) {
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
  const systemPrompt = buildSystemPrompt(topic.name, topic.aiSystemPrompt)
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

  // 進捗を更新
  await deps.topicRepo.upsertProgress({
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
  const topic = await deps.topicRepo.findTopicById(input.topicId)
  if (!topic) {
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
  const systemPrompt = buildSystemPrompt(topic.name, topic.aiSystemPrompt)
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

  // 進捗を更新
  await deps.topicRepo.upsertProgress({
    userId: input.userId,
    topicId: input.topicId,
    incrementQuestionCount: true,
  })

  // メッセージ保存後に"done"を送信
  yield { type: "done" as const, messageId: userMessage.id }
}

type QuestionEvaluation = {
  quality: "good" | "surface"
  reason: string
}

export const evaluateQuestion = async (
  deps: ChatDeps,
  messageId: string,
  content: string
): Promise<QuestionEvaluation> => {
  const evaluationPrompt = buildEvaluationPrompt(content)

  const result = await deps.aiAdapter.generateText({
    model: deps.aiConfig.evaluation.model,
    messages: [{ role: "user", content: evaluationPrompt }],
    temperature: deps.aiConfig.evaluation.temperature,
    maxTokens: deps.aiConfig.evaluation.maxTokens,
  })

  // JSONパース（コードブロックの除去も対応）
  let quality: "good" | "surface" = "surface"
  let reason = ""
  try {
    const jsonStr = result.content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim()
    const parsed = JSON.parse(jsonStr) as { quality?: string; reason?: string }
    quality = parsed.quality?.toLowerCase().includes("good") ? "good" : "surface"
    reason = parsed.reason ?? ""
  } catch {
    // パースに失敗した場合はシンプルな判定にフォールバック
    quality = result.content.toLowerCase().includes("good") ? "good" : "surface"
    reason = ""
  }

  await deps.chatRepo.updateMessageQuality(messageId, quality, reason)

  return { quality, reason }
}
