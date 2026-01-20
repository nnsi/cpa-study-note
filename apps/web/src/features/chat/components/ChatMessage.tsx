import type { DisplayMessage } from "../logic"

type Props = {
  message: DisplayMessage
  isStreaming?: boolean
}

export const ChatMessageView = ({ message, isStreaming }: Props) => {
  return (
    <div
      className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          message.isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {!isStreaming && (
          <div
            className={`flex items-center gap-2 mt-2 text-xs ${
              message.isUser ? "text-blue-200" : "text-gray-500"
            }`}
          >
            <span>{message.formattedTime}</span>
            {message.questionQuality && (
              <span
                className={`font-medium ${
                  message.questionQuality === "good"
                    ? "text-green-500"
                    : "text-orange-500"
                }`}
              >
                {message.questionQuality === "good" ? "✔︎" : "△"}
              </span>
            )}
          </div>
        )}

        {isStreaming && (
          <div className="flex items-center gap-1 mt-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            />
            <span
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
