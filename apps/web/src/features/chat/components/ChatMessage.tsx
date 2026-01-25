import { useState } from "react"
import Markdown, { type Components } from "react-markdown"
import type { DisplayMessage } from "../logic"

const API_URL = import.meta.env.VITE_API_URL || ""

// マークダウンコンポーネントのカスタム設定
const markdownComponents: Components = {
  // リンクは新しいタブで開く
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
      {children}
    </a>
  ),
  // コードブロックのスタイル
  code: ({ children, className }) => {
    const isInline = !className
    return isInline ? (
      <code className="px-1 py-0.5 bg-ink-100 rounded text-ink-700 text-xs font-mono">
        {children}
      </code>
    ) : (
      <code className={`${className || ""} text-xs font-mono`}>{children}</code>
    )
  },
  // コードブロックをpreで囲む
  pre: ({ children }) => (
    <pre className="bg-ink-100 rounded p-3 overflow-x-auto my-2">{children}</pre>
  ),
  // 見出しのサイズ調整
  h1: ({ children }) => <h3 className="text-base font-bold mt-3 mb-2">{children}</h3>,
  h2: ({ children }) => <h4 className="text-sm font-bold mt-3 mb-2">{children}</h4>,
  h3: ({ children }) => <h5 className="text-sm font-semibold mt-2 mb-1">{children}</h5>,
  // リストのスタイル
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
  li: ({ children }) => <li className="text-ink-800">{children}</li>,
  // 段落
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  // 強調
  strong: ({ children }) => <strong className="font-semibold text-ink-900">{children}</strong>,
  // 水平線
  hr: () => <hr className="my-3 border-ink-200" />,
}

type Props = {
  message: DisplayMessage
  isStreaming?: boolean
}

// 画像プレビューモーダル
const ImagePreviewModal = ({
  imageUrl,
  onClose,
}: {
  imageUrl: string
  onClose: () => void
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    onClick={onClose}
  >
    <div className="relative max-w-4xl max-h-[90vh]">
      <img
        src={imageUrl}
        alt="プレビュー"
        className="max-w-full max-h-[90vh] object-contain rounded-lg"
        crossOrigin="use-credentials"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute -top-3 -right-3 size-8 bg-white rounded-full shadow-lg flex items-center justify-center text-ink-600 hover:text-ink-800 transition-colors"
      >
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
)

export const ChatMessageView = ({ message, isStreaming }: Props) => {
  const isUser = message.isUser
  const [showPreview, setShowPreview] = useState(false)

  // 画像URLを生成
  const imageUrl = message.imageId
    ? `${API_URL}/api/images/${message.imageId}/file`
    : null

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
        {/* 添付画像 */}
        {imageUrl && isUser && (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="mb-2 block rounded-lg overflow-hidden border border-white/20 hover:opacity-90 transition-opacity"
          >
            <img
              src={imageUrl}
              alt="添付画像"
              className="max-w-full max-h-48 object-contain bg-white/10"
              crossOrigin="use-credentials"
            />
          </button>
        )}

        {/* メッセージ本文 */}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words leading-relaxed text-white">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none break-words text-ink-800">
            <Markdown components={markdownComponents}>
              {message.content}
            </Markdown>
          </div>
        )}

        {/* メタ情報 */}
        {!isStreaming && (
          <div className={`flex items-center gap-2 mt-2.5 pt-2 border-t ${
            isUser ? "border-white/20" : "border-ink-100"
          }`}>
            <span className={`text-2xs ${isUser ? "text-indigo-200" : "text-ink-500"}`}>
              {message.formattedTime}
            </span>

            {/* 質問の質インジケーター */}
            {message.questionQuality === "good" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-jade-100 text-jade-600">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                深掘り
              </span>
            )}
            {message.questionQuality === "surface" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-amber-100 text-amber-600">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 22h20L12 2zm0 4.5l7.5 13H4.5L12 6.5z" />
                </svg>
                確認
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

      {/* 画像プレビューモーダル */}
      {showPreview && imageUrl && (
        <ImagePreviewModal
          imageUrl={imageUrl}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
