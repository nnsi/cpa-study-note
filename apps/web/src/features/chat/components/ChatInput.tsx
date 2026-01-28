import { useState, useRef, KeyboardEvent } from "react"
import { ImageUploader } from "@/features/image"

type Props = {
  content: string
  isSubmitting: boolean
  imageId?: string | null
  ocrText?: string | null
  isListening?: boolean
  isSpeechSupported?: boolean
  onContentChange: (value: string) => void
  onImageSelect: (id: string, ocrText: string | null) => void
  onImageClear: () => void
  onSubmit: () => void
  onToggleListening?: () => void
}

export const ChatInputView = ({
  content,
  isSubmitting,
  imageId,
  ocrText,
  isListening = false,
  isSpeechSupported = false,
  onContentChange,
  onImageSelect,
  onImageClear,
  onSubmit,
  onToggleListening,
}: Props) => {
  const [showUploader, setShowUploader] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleImageComplete = (id: string, text: string | null) => {
    onImageSelect(id, text)
    setShowUploader(false)
  }

  return (
    <>
      <div className="border-t border-ink-100 bg-white/80 backdrop-blur-sm px-2 py-2 my-3 lg:px-4 lg:py-3">
        {/* 画像プレビュー */}
        {imageId && (
          <div className="mb-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg className="size-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-700">画像が添付されています</p>
                {ocrText && (
                  <p className="text-xs text-indigo-500 mt-0.5 line-clamp-1">
                    {ocrText.slice(0, 40)}...
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onImageClear}
              className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex gap-1 items-center">
          {/* 画像アップロードボタン */}
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            disabled={isSubmitting || !!imageId}
            className="flex-shrink-0 p-1 text-ink-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="画像をアップロード"
          >
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </button>

          {/* 音声入力ボタン */}
          {isSpeechSupported && (
            <button
              type="button"
              onClick={onToggleListening}
              disabled={isSubmitting}
              className={`flex-shrink-0 p-1 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening
                  ? "text-crimson-600 bg-crimson-50 animate-pulse"
                  : "text-ink-400 hover:text-indigo-600 hover:bg-indigo-50"
              }`}
              title={isListening ? "音声入力を停止" : "音声入力を開始"}
            >
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </button>
          )}

          {/* テキスト入力 */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                imageId
                  ? "この画像について質問..."
                  : "Shift+Enterで改行"
              }
              className="textarea-field pr-4"
              rows={1}
              disabled={isSubmitting}
              style={{
                minHeight: "36px",
                maxHeight: "120px",
              }}
            />
          </div>

          {/* 送信ボタン */}
          <button
            onClick={onSubmit}
            disabled={isSubmitting || !content.trim()}
            className="flex-shrink-0 btn-primary size-9 !p-0 flex items-center justify-center disabled:opacity-40"
          >
            {isSubmitting ? (
              <svg className="animate-spin size-5" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {showUploader && (
        <ImageUploader
          onComplete={handleImageComplete}
          onCancel={() => setShowUploader(false)}
        />
      )}
    </>
  )
}
