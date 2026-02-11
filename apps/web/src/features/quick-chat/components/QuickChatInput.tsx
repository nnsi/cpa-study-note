import { useCallback, useRef, type KeyboardEvent } from "react"
import { useQuickChat } from "../hooks"
import { useSpeechRecognition } from "@/features/chat/hooks"
import type { QuickChatSuggestion } from "@cpa-study/shared/schemas"

type QuickChatInputProps = {
  domainId: string | null
}

export function QuickChatInput({ domainId }: QuickChatInputProps) {
  const {
    question,
    setQuestion,
    suggestions,
    isLoading,
    error,
    handleSubmitQuestion,
    handleSelectExistingTopic,
    handleClear,
  } = useQuickChat({ domainId })

  const inputRef = useRef<HTMLInputElement>(null)

  const handleSpeechResult = useCallback(
    (transcript: string) => {
      setQuestion((prev) => prev + transcript)
    },
    [setQuestion]
  )

  const { isListening, isSupported, toggleListening } = useSpeechRecognition({
    onResult: handleSpeechResult,
  })

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        e.preventDefault()
        handleSubmitQuestion()
      }
    },
    [handleSubmitQuestion]
  )

  return (
    <div className="space-y-3">
      {/* 入力エリア */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="質問を入力して学習を始める..."
          disabled={!domainId}
          className="w-full pl-4 pr-20 py-3 rounded-xl border border-ink-200 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* 音声入力ボタン */}
          {isSupported && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={!domainId}
              className={`p-2 rounded-lg transition-colors ${
                isListening
                  ? "bg-crimson-100 text-crimson-600"
                  : "text-ink-400 hover:text-ink-600 hover:bg-ink-100"
              } disabled:opacity-50`}
              title={isListening ? "音声認識を停止" : "音声で入力"}
            >
              {isListening ? (
                <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
              )}
            </button>
          )}
          {/* 送信ボタン */}
          <button
            type="button"
            onClick={handleSubmitQuestion}
            disabled={!question.trim() || !domainId || isLoading}
            className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            title="送信"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 音声認識中のインジケーター */}
      {isListening && (
        <div className="flex items-center gap-2 text-sm text-crimson-600 px-1">
          <span className="inline-block w-2 h-2 rounded-full bg-crimson-500 animate-pulse" />
          音声を認識中...
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="text-sm text-crimson-600 px-1">
          {error.message}
        </div>
      )}

      {/* サジェスト結果 */}
      {suggestions && suggestions.length > 0 && (
        <SuggestionList
          suggestions={suggestions}
          onSelectExisting={handleSelectExistingTopic}
          onClear={handleClear}
        />
      )}

      {/* サジェスト結果が空の場合 */}
      {suggestions && suggestions.length === 0 && !isLoading && (
        <div className="text-sm text-ink-500 px-1">
          関連する論点が見つかりませんでした。質問を変えてみてください。
        </div>
      )}
    </div>
  )
}

function SuggestionList({
  suggestions,
  onSelectExisting,
  onClear,
}: {
  suggestions: QuickChatSuggestion[]
  onSelectExisting: (suggestion: QuickChatSuggestion) => void
  onClear: () => void
}) {
  const existingSuggestions = suggestions.filter((s) => s.type === "existing")
  const newSuggestions = suggestions.filter((s) => s.type === "new")

  return (
    <div className="rounded-xl border border-ink-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-ink-100 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-700">関連する論点</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-ink-400 hover:text-ink-600 transition-colors"
        >
          閉じる
        </button>
      </div>

      <div className="divide-y divide-ink-100">
        {existingSuggestions.map((suggestion) => (
          <button
            key={suggestion.topicId}
            type="button"
            onClick={() => onSelectExisting(suggestion)}
            className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-400 group-hover:border-indigo-600 group-hover:bg-indigo-600 transition-colors flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-white transition-colors" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900 truncate">
                    {suggestion.topicName}
                  </span>
                  {suggestion.confidence === "high" && (
                    <span className="shrink-0 text-2xs px-1.5 py-0.5 rounded bg-jade-100 text-jade-700 font-medium">
                      推奨
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-500 mt-0.5 truncate">
                  {suggestion.subjectName} &rsaquo; {suggestion.categoryName}
                </p>
                {suggestion.reason && (
                  <p className="text-xs text-ink-400 mt-0.5">{suggestion.reason}</p>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* 新規論点提案 */}
        {newSuggestions.length > 0 && (
          <>
            {existingSuggestions.length > 0 && (
              <div className="px-4 py-1.5 bg-ink-50">
                <span className="text-2xs text-ink-400 font-medium">新規論点の作成</span>
              </div>
            )}
            {newSuggestions.map((suggestion, index) => (
              <div
                key={`new-${index}`}
                className="w-full text-left px-4 py-3 opacity-70"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-ink-700 truncate block">
                      {suggestion.topicName}
                    </span>
                    <p className="text-xs text-ink-500 mt-0.5 truncate">
                      {suggestion.subjectName} &rsaquo; {suggestion.categoryName}
                    </p>
                    <p className="text-xs text-ink-400 mt-1">
                      ※ 新規論点の作成は論点マップから行えます
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
