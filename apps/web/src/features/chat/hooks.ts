import { useState, useCallback, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"
import * as logic from "./logic"

// Web Speech API の型定義
type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList
  resultIndex: number
}

type SpeechRecognitionErrorEvent = {
  error: string
  message?: string
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

type UseSpeechRecognitionOptions = {
  onResult: (transcript: string) => void
  onError?: (error: string) => void
}

export const useSpeechRecognition = ({ onResult, onError }: UseSpeechRecognitionOptions) => {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)

  // コールバックを最新の状態に保つ
  useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
  }, [onResult, onError])

  useEffect(() => {
    // ブラウザサポートチェック
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "ja-JP"

      recognition.onresult = (event) => {
        // 最新の結果を取得
        let finalTranscript = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result?.isFinal && result[0]) {
            finalTranscript += result[0].transcript
          }
        }
        if (finalTranscript) {
          onResultRef.current(finalTranscript)
        }
      }

      recognition.onerror = (event) => {
        const errorMessages: Record<string, string> = {
          "no-speech": "音声が検出されませんでした",
          "audio-capture": "マイクにアクセスできません",
          "not-allowed": "マイクの使用が許可されていません",
          "network": "ネットワークエラーが発生しました",
        }
        const message = errorMessages[event.error] || `音声認識エラー: ${event.error}`
        onErrorRef.current?.(message)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognitionRef.current = recognition
    }

    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start()
      } catch {
        // 既に開始している場合のエラーを無視
      }
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }, [isListening])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  }
}

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

      // バッファリング用の変数（再レンダリング抑制）
      let textBuffer = ""
      let rafId: number | null = null

      const flushBuffer = () => {
        if (textBuffer) {
          setStreamingText((prev) => prev + textBuffer)
          textBuffer = ""
        }
        rafId = null
      }

      try {
        let userMessageId: string | undefined
        let currentSessionId = sessionId
        let newSessionId: string | undefined

        // セッションがない場合は新規セッション作成APIを使用
        const streamSource = sessionId
          ? api.streamMessage(sessionId, content, imageId, ocrResult)
          : api.streamMessageWithNewSession(topicId, content, imageId, ocrResult)

        for await (const chunk of streamSource) {
          if (chunk.type === "session_created") {
            // 新規セッションが作成された（ストリーミング完了後に通知）
            currentSessionId = chunk.sessionId
            newSessionId = chunk.sessionId
          } else if (chunk.type === "text") {
            // バッファに蓄積し、次のフレームで一括更新
            textBuffer += chunk.content
            if (!rafId) {
              rafId = requestAnimationFrame(flushBuffer)
            }
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
            // 新規セッションが作成されていた場合、ストリーミング完了後に親に通知
            // （key変更によるコンポーネント再マウントを防ぐため）
            if (newSessionId) {
              onSessionCreated?.(newSessionId)
            }
          } else if (chunk.type === "error") {
            setError(new Error(chunk.error))
          }
        }

        // ループ終了後、残りのバッファをフラッシュ
        if (rafId) {
          cancelAnimationFrame(rafId)
        }
        flushBuffer()

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
