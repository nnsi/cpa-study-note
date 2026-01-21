import type { DisplayMessage } from "../logic"

type Props = {
  message: DisplayMessage
  isStreaming?: boolean
}

export const ChatMessageView = ({ message, isStreaming }: Props) => {
  const isUser = message.isUser

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up`}>
      {/* AIアバター */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-soft">
            <svg className="size-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
          </div>
        </div>
      )}

      {/* メッセージバブル */}
      <div
        className={`max-w-[75%] ${
          isUser
            ? "chat-bubble-user"
            : "chat-bubble-ai"
        }`}
      >
        {/* メッセージ本文 */}
        <div className={`whitespace-pre-wrap break-words leading-relaxed ${isUser ? "text-white" : "text-ink-800"}`}>
          {message.content}
        </div>

        {/* メタ情報 */}
        {!isStreaming && (
          <div className={`flex items-center gap-2 mt-2.5 pt-2 border-t ${
            isUser ? "border-white/20" : "border-ink-100"
          }`}>
            <span className={`text-2xs ${isUser ? "text-indigo-200" : "text-ink-500"}`}>
              {message.formattedTime}
            </span>

            {/* 質問品質インジケーター */}
            {message.questionQuality && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium ${
                  message.questionQuality === "good"
                    ? "bg-jade-100 text-jade-600"
                    : "bg-amber-100 text-amber-600"
                }`}
              >
                {message.questionQuality === "good" ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    良質
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    改善可
                  </>
                )}
              </span>
            )}
          </div>
        )}

        {/* ストリーミングインジケーター */}
        {isStreaming && (
          <div className="flex items-center gap-1.5 mt-3">
            <span className="size-1.5 bg-indigo-400 rounded-full animate-pulse" />
            <span className="size-1.5 bg-indigo-400 rounded-full animate-pulse animation-delay-100" />
            <span className="size-1.5 bg-indigo-400 rounded-full animate-pulse animation-delay-200" />
          </div>
        )}
      </div>

      {/* ユーザーアバター */}
      {isUser && (
        <div className="flex-shrink-0 ml-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-ink-200 to-ink-300 flex items-center justify-center">
            <svg className="size-4 text-ink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
