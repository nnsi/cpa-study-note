import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"
import * as logic from "./logic"

export const useChatMessages = (sessionId: string) => {
  const { data: messagesData, ...query } = useQuery({
    queryKey: ["chat", sessionId, "messages"],
    queryFn: () => api.getMessages(sessionId),
    refetchInterval: false,
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

export const useSendMessage = (sessionId: string) => {
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

        for await (const chunk of api.streamMessage(
          sessionId,
          content,
          imageId,
          ocrResult
        )) {
          if (chunk.type === "text") {
            setStreamingText((prev) => prev + chunk.content)
          } else if (chunk.type === "done") {
            userMessageId = chunk.messageId
            // メッセージ一覧を再取得
            queryClient.invalidateQueries({
              queryKey: ["chat", sessionId, "messages"],
            })
            // セッション一覧のメッセージ数を更新
            queryClient.invalidateQueries({
              queryKey: ["chat", "sessions"],
            })
          } else if (chunk.type === "error") {
            setError(new Error(chunk.error))
          }
        }

        // ユーザーメッセージの質問評価を実行（バックグラウンド）
        if (userMessageId) {
          api.evaluateMessage(userMessageId).then(() => {
            // 評価完了後にメッセージ一覧を再取得してバッジを更新
            queryClient.invalidateQueries({
              queryKey: ["chat", sessionId, "messages"],
            })
          }).catch(() => {
            // 評価エラーは無視（UXに影響しない）
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
    [sessionId, queryClient]
  )

  return { streamingText, isStreaming, pendingUserMessage, error, sendMessage }
}

export const useChatInput = (sessionId: string) => {
  const [content, setContent] = useState("")
  const [imageId, setImageId] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const { sendMessage, isStreaming, pendingUserMessage, error, streamingText } =
    useSendMessage(sessionId)

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

export const useChat = (sessionId: string) => {
  const messages = useChatMessages(sessionId)
  const input = useChatInput(sessionId)

  return { messages, input }
}
