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

export const useSendMessage = (sessionId: string) => {
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const queryClient = useQueryClient()

  const sendMessage = useCallback(
    async (content: string, imageId?: string, ocrResult?: string) => {
      setStreamingText("")
      setIsStreaming(true)
      setError(null)

      try {
        for await (const chunk of api.streamMessage(
          sessionId,
          content,
          imageId,
          ocrResult
        )) {
          if (chunk.type === "text") {
            setStreamingText((prev) => prev + chunk.content)
          } else if (chunk.type === "done") {
            // メッセージ一覧を再取得
            queryClient.invalidateQueries({
              queryKey: ["chat", sessionId, "messages"],
            })
          } else if (chunk.type === "error") {
            setError(new Error(chunk.error))
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
      } finally {
        setIsStreaming(false)
        setStreamingText("")
      }
    },
    [sessionId, queryClient]
  )

  return { streamingText, isStreaming, error, sendMessage }
}

export const useChatInput = (sessionId: string) => {
  const [content, setContent] = useState("")
  const [imageId, setImageId] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const { sendMessage, isStreaming, error, streamingText } =
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
