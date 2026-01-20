import { useState, useRef, KeyboardEvent } from "react"
import { ImageUploader } from "@/features/image"

type Props = {
  content: string
  isSubmitting: boolean
  imageId?: string | null
  ocrText?: string | null
  onContentChange: (value: string) => void
  onImageSelect: (id: string, ocrText: string | null) => void
  onImageClear: () => void
  onSubmit: () => void
}

export const ChatInputView = ({
  content,
  isSubmitting,
  imageId,
  ocrText,
  onContentChange,
  onImageSelect,
  onImageClear,
  onSubmit,
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
      <div className="border-t bg-white p-4">
        {/* 画像プレビュー */}
        {imageId && (
          <div className="mb-3 p-2 bg-blue-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <span>📷</span>
              <span>画像が添付されています</span>
              {ocrText && (
                <span className="text-blue-500">
                  ({ocrText.slice(0, 30)}...)
                </span>
              )}
            </div>
            <button
              onClick={onImageClear}
              className="text-blue-500 hover:text-blue-700"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            disabled={isSubmitting || !!imageId}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="画像をアップロード"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                imageId
                  ? "この画像について質問..."
                  : "質問を入力... (Shift+Enterで改行)"
              }
              className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={1}
              disabled={isSubmitting}
              style={{
                minHeight: "42px",
                maxHeight: "120px",
              }}
            />
          </div>

          <button
            onClick={onSubmit}
            disabled={isSubmitting || !content.trim()}
            className="btn-primary h-[42px] px-4"
          >
            {isSubmitting ? (
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
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
              "送信"
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
