import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"
import * as logic from "./logic"

export const useChatMessages = (sessionId: string | null) => {
  const { data: messagesData, ...query } = useQuery({
    queryKey: ["chat", sessionId, "messages"],
    queryFn: () => (sessionId ? api.getMessages(sessionId) : Promise.resolve({ messages: [] })),
    refetchInterval: false,
    enabled: !!sessionId,
  })

  const messages = messagesData?.messages || []
  const displayMessages = logic.formatMessagesForDisplay(messages)
  const qualityStats = logic.countQuestionQuality(messages)

  return { messages, displayMessages, qualityStats, ...query }
}

type PendingUserMessage = {
  content: string
  imageId?: string
}

type UseSendMessageOptions = {
  sessionId: string | null
  topicId: string
  onSessionCreated?: (sessionId: string) => void
}

export const useSendMessage = ({ sessionId, topicId, onSessionCreated }: UseSendMessageOptions) => {
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [pendingUserMessage, setPendingUserMessage] =
    useState<PendingUserMessage | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const queryClient = useQueryClient()

  const sendMessage = useCallback(
    async (content: string, imageId?: string, ocrResult?: string) => {
      setStreamingText("")
      setIsStreaming(true)
      setError(null)
      // ユーザーメッセージを即時表示
      setPendingUserMessage({ content, imageId })

      try {
        let userMessageId: string | undefined
        let currentSessionId = sessionId

        // セッションがない場合は新規セッション作成APIを使用
        const streamSource = sessionId
          ? api.streamMessage(sessionId, content, imageId, ocrResult)
          : api.streamMessageWithNewSession(topicId, content, imageId, ocrResult)

        for await (const chunk of streamSource) {
          if (chunk.type === "session_created") {
            // 新規セッションが作成された
            currentSessionId = chunk.sessionId
            onSessionCreated?.(chunk.sessionId)
          } else if (chunk.type === "text") {
            setStreamingText((prev) => prev + chunk.content)
          } else if (chunk.type === "done") {
            userMessageId = chunk.messageId
            // メッセージ一覧を再取得
            if (currentSessionId) {
              queryClient.invalidateQueries({
                queryKey: ["chat", currentSessionId, "messages"],
              })
            }
            // セッション一覧のメッセージ数を更新
            queryClient.invalidateQueries({
              queryKey: ["chat", "sessions"],
            })
          } else if (chunk.type === "error") {
            setError(new Error(chunk.error))
          }
        }

        // ユーザーメッセージの質問評価を実行（バックグラウンド）
        if (userMessageId && currentSessionId) {
          api.evaluateMessage(userMessageId).then(() => {
            // 評価完了後にメッセージ一覧を再取得してバッジを更新
            queryClient.invalidateQueries({
              queryKey: ["chat", currentSessionId, "messages"],
            })
          }).catch((e) => {
            // 評価エラーはUXに影響しないが、開発時はログ出力
            if (import.meta.env.DEV) {
              console.warn("Message evaluation failed:", e)
            }
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
      } finally {
        setIsStreaming(false)
        setStreamingText("")
        setPendingUserMessage(null)
      }
    },
    [sessionId, topicId, queryClient, onSessionCreated]
  )

  return { streamingText, isStreaming, pendingUserMessage, error, sendMessage }
}

type UseChatInputOptions = {
  sessionId: string | null
  topicId: string
  onSessionCreated?: (sessionId: string) => void
}

export const useChatInput = ({ sessionId, topicId, onSessionCreated }: UseChatInputOptions) => {
  const [content, setContent] = useState("")
  const [imageId, setImageId] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const { sendMessage, isStreaming, pendingUserMessage, error, streamingText } =
    useSendMessage({ sessionId, topicId, onSessionCreated })

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
  }, [])

  const handleImageSelect = useCallback((id: string, text: string | null) => {
    setImageId(id)
    setOcrText(text)
  }, [])

  const handleImageClear = useCallback(() => {
    setImageId(null)
    setOcrText(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || isStreaming) return

    const currentContent = content
    const currentImageId = imageId
    const currentOcrText = ocrText
    setContent("")
    setImageId(null)
    setOcrText(null)

    await sendMessage(
      currentContent,
      currentImageId ?? undefined,
      currentOcrText ?? undefined
    )
  }, [content, imageId, ocrText, isStreaming, sendMessage])

  return {
    content,
    imageId,
    ocrText,
    isStreaming,
    streamingText,
    pendingUserMessage,
    error,
    handleContentChange,
    handleImageSelect,
    handleImageClear,
    handleSubmit,
  }
}

type UseChatOptions = {
  sessionId: string | null
  topicId: string
  onSessionCreated?: (sessionId: string) => void
}

export const useChat = ({ sessionId, topicId, onSessionCreated }: UseChatOptions) => {
  const messages = useChatMessages(sessionId)
  const input = useChatInput({ sessionId, topicId, onSessionCreated })

  return { messages, input }
}
