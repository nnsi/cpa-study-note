import { useRef, useEffect } from "react"
import { useChat } from "../hooks"
import { ChatMessageView } from "./ChatMessage"
import { ChatInputView } from "./ChatInput"

type Props = {
  sessionId: string
  topicId: string
}

export const ChatContainer = ({ sessionId, topicId }: Props) => {
  const { messages, input } = useChat(sessionId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.displayMessages, input.streamingText])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.displayMessages.length === 0 && !input.streamingText && (
          <div className="text-center text-gray-500 py-8">
            <p className="mb-2">この論点について質問してみましょう</p>
            <p className="text-sm">
              良質な質問をすると ✔︎ マークがつきます
            </p>
          </div>
        )}

        {messages.displayMessages.map((msg) => (
          <ChatMessageView key={msg.id} message={msg} />
        ))}

        {/* ストリーミング中のメッセージ */}
        {input.streamingText && (
          <ChatMessageView
            message={{
              id: "streaming",
              sessionId,
              role: "assistant",
              content: input.streamingText,
              imageId: null,
              ocrResult: null,
              questionQuality: null,
              createdAt: new Date().toISOString(),
              formattedTime: "",
              isUser: false,
            }}
            isStreaming
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInputView
        content={input.content}
        isSubmitting={input.isStreaming}
        imageId={input.imageId}
        ocrText={input.ocrText}
        onContentChange={input.handleContentChange}
        onImageSelect={input.handleImageSelect}
        onImageClear={input.handleImageClear}
        onSubmit={input.handleSubmit}
      />
    </div>
  )
}
