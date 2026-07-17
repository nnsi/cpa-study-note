export type ChatMessage = {
  id: string
  sessionId: string
  role: string
  content: string
  imageId: string | null
  ocrResult: string | null
  questionQuality: string | null
  createdAt: string
}

export type DisplayMessage = ChatMessage & {
  formattedTime: string
  isUser: boolean
}

// メッセージをロール別にフィルタリング
export const filterMessagesByRole = (
  messages: ChatMessage[],
  role: ChatMessage["role"]
): ChatMessage[] => messages.filter((m) => m.role === role)

// 質問の質をカウント
export const countQuestionQuality = (messages: ChatMessage[]) => {
  const userMessages = filterMessagesByRole(messages, "user")
  return {
    total: userMessages.length,
    good: userMessages.filter((m) => m.questionQuality === "good").length,
    surface: userMessages.filter((m) => m.questionQuality === "surface").length,
  }
}

// メッセージリストを表示用に整形
export const formatMessagesForDisplay = (
  messages: ChatMessage[]
): DisplayMessage[] =>
  messages.map((m) => ({
    ...m,
    formattedTime: new Date(m.createdAt).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isUser: m.role === "user",
  }))

// チャットの「空の状態」UIを表示すべきか判定する。
// メッセージ読込中（isLoading）は、履歴があるセッションを開いた直後や
// 新規セッションの初回送信完了後の再マウント直後に空状態が一瞬フラッシュ
// 表示されるのを防ぐため、読込完了までは表示しない。
export const shouldShowEmptyState = ({
  displayMessagesCount,
  streamingText,
  isLoading,
}: {
  displayMessagesCount: number
  streamingText: string
  isLoading: boolean
}): boolean => displayMessagesCount === 0 && !streamingText && !isLoading
