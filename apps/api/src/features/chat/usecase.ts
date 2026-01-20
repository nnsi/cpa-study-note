import type { AIAdapter, AIMessage, StreamChunk } from "@/shared/lib/ai"
import type { ChatRepository, ChatMessage } from "./repository"
import type { TopicRepository } from "../topic/repository"

type ChatDeps = {
  chatRepo: ChatRepository
  topicRepo: TopicRepository
  aiAdapter: AIAdapter
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

// メッセージ取得（評価用）
export const getMessageForEvaluation = async (
  deps: Pick<ChatDeps, "chatRepo">,
  messageId: string
): Promise<{ content: string } | null> => {
  const message = await deps.chatRepo.findMessageById(messageId)
  if (!message) {
    return null
  }
  return { content: message.content }
}

type SendMessageInput = {
  sessionId: string
  userId: string
  content: string
  imageId?: string
  ocrResult?: string
}

const AI_MODEL = "deepseek/deepseek-chat"

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
  const systemPrompt =
    topic.aiSystemPrompt ||
    `あなたは公認会計士試験の学習をサポートするAIアシスタントです。
現在の論点: ${topic.name}

この論点に関する質問に対して、以下の方針で回答してください：
- 論点の範囲内で回答する
- 理解を深めるための説明を心がける
- 正確性を保ちつつ、分かりやすく説明する
- 他の論点への脱線を避ける`

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

  for await (const chunk of deps.aiAdapter.streamText({
    model: AI_MODEL,
    messages,
    temperature: 0.7,
    maxTokens: 2000,
  })) {
    if (chunk.type === "text" && chunk.content) {
      fullResponse += chunk.content
      yield chunk
    }
    // "done"チャンクはメッセージ保存後に送信するためここではyieldしない
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

export const evaluateQuestion = async (
  deps: ChatDeps,
  messageId: string,
  content: string
): Promise<"good" | "surface"> => {
  const evaluationPrompt = `以下のユーザーの質問を評価してください。

質問: ${content}

評価基準:
- "good": 因果関係を問う質問、前提を明示している、仮説が含まれている
- "surface": 単純な確認、表層的な質問

回答は "good" または "surface" のみを返してください。`

  const result = await deps.aiAdapter.generateText({
    model: AI_MODEL,
    messages: [{ role: "user", content: evaluationPrompt }],
    temperature: 0,
    maxTokens: 10,
  })

  const quality = result.content.toLowerCase().includes("good") ? "good" : "surface"

  await deps.chatRepo.updateMessageQuality(messageId, quality)

  return quality
}
