import { useRef, useEffect, useCallback, useState } from "react"
import { useChat, useSpeechRecognition } from "../hooks"
import { ChatMessageView } from "./ChatMessage"
import { ChatInputView } from "./ChatInput"
import { useCreateNote, useNoteBySession } from "@/features/note"

type Props = {
  sessionId: string | null
  topicId: string
  onSessionCreated?: (sessionId: string) => void
  onNavigateToNotes?: () => void
}

export const ChatContainer = ({ sessionId, topicId, onSessionCreated, onNavigateToNotes }: Props) => {
  const { messages, input } = useChat({ sessionId, topicId, onSessionCreated })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { mutate: createNote, isPending: isCreatingNote } = useCreateNote(topicId)
  const { data: existingNote } = useNoteBySession(sessionId)
  const [speechError, setSpeechError] = useState<string | null>(null)

  // 音声認識でテキストを取得したら入力欄に追加
  const handleSpeechResult = useCallback((transcript: string) => {
    input.handleContentChange(input.content + transcript)
  }, [input])

  const handleSpeechError = useCallback((error: string) => {
    setSpeechError(error)
    // 3秒後にエラーを消す
    setTimeout(() => setSpeechError(null), 3000)
  }, [])

  const { isListening, isSupported, toggleListening } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onError: handleSpeechError,
  })

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.displayMessages, input.pendingUserMessage, input.streamingText])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* メッセージエリア */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6 space-y-4">
        {/* 空の状態 */}
        {messages.displayMessages.length === 0 && !input.streamingText && (
          <div className="flex flex-col items-center justify-center h-full py-12 animate-fade-in">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mb-6">
              <svg className="size-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <h3 className="heading-serif text-lg text-ink-700 mb-2">
              この論点について質問してみましょう
            </h3>
            <p className="text-sm text-ink-500 text-center max-w-xs">
              深い質問には
              <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-jade-100 text-jade-600 rounded text-xs font-medium">
                <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                深掘り
              </span>
              マークがつきます
            </p>
          </div>
        )}

        {/* メッセージリスト */}
        {messages.displayMessages.map((msg) => (
          <ChatMessageView key={msg.id} message={msg} />
        ))}

        {/* 送信中のユーザーメッセージ */}
        {input.pendingUserMessage && (
          <ChatMessageView
            message={{
              id: "pending-user",
              sessionId: sessionId ?? "new",
              role: "user",
              content: input.pendingUserMessage.content,
              imageId: input.pendingUserMessage.imageId ?? null,
              ocrResult: null,
              questionQuality: null,
              createdAt: new Date().toISOString(),
              formattedTime: "",
              isUser: true,
            }}
          />
        )}

        {/* ストリーミング中のAI応答 */}
        {input.streamingText && (
          <ChatMessageView
            message={{
              id: "streaming",
              sessionId: sessionId ?? "new",
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

        {/* スマホ用ノート作成ボタン */}
        {messages.displayMessages.length > 0 && sessionId && (
          <div className="lg:hidden pt-3 pb-0">
            {existingNote?.note ? (
              <button
                onClick={onNavigateToNotes}
                className="flex items-center justify-center gap-2 text-sm text-jade-600"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                ノートに記録済み
              </button>
            ) : (
              <button
                onClick={() => {
                  if (sessionId) {
                    createNote(sessionId)
                  }
                }}
                disabled={isCreatingNote}
                className="flex items-center justify-center gap-2 text-sm text-indigo-600 disabled:text-ink-400"
              >
                {isCreatingNote ? (
                  <>
                    <svg className="animate-spin size-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    作成中...
                  </>
                ) : (
                  <>
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    ノートを作成する
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ノート作成バー（PC版のみ表示、スマホはノートタブで代替） */}
      {messages.displayMessages.length > 0 && sessionId && (
        <div className="hidden lg:block px-4 py-3 border-t border-ink-100 bg-ink-50/50">
          {existingNote?.note ? (
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-2 text-jade-600">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm font-medium">ノートに記録済み</span>
              </div>
              <button
                onClick={onNavigateToNotes}
                className="text-sm text-indigo-500 hover:text-indigo-600 hover:underline"
              >
                確認する
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (sessionId) {
                  createNote(sessionId)
                }
              }}
              disabled={isCreatingNote}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors disabled:text-ink-400 disabled:cursor-not-allowed"
            >
              {isCreatingNote ? (
                <>
                  <svg className="animate-spin size-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  ノートを作成中...
                </>
              ) : (
                <>
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  この会話からノートを作成
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* 音声認識エラー表示 */}
      {speechError && (
        <div className="mx-4 mb-2 px-4 py-2 bg-crimson-50 border border-crimson-200 text-crimson-700 text-sm rounded-xl animate-fade-in">
          {speechError}
        </div>
      )}

      <ChatInputView
        content={input.content}
        isSubmitting={input.isStreaming}
        imageId={input.imageId}
        ocrText={input.ocrText}
        isListening={isListening}
        isSpeechSupported={isSupported}
        onContentChange={input.handleContentChange}
        onImageSelect={input.handleImageSelect}
        onImageClear={input.handleImageClear}
        onSubmit={input.handleSubmit}
        onToggleListening={toggleListening}
      />
    </div>
  )
}
