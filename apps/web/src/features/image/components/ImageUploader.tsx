import { useRef, ChangeEvent } from "react"
import { useImageUpload } from "../hooks"

type Props = {
  onComplete: (imageId: string, ocrText: string | null) => void
  onCancel: () => void
}

export const ImageUploader = ({ onComplete, onCancel }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const { status, imageId, ocrText, error, previewUrl, upload, reset } =
    useImageUpload()

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      upload(file)
    }
  }

  const handleConfirm = () => {
    if (imageId) {
      onComplete(imageId, ocrText)
    }
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  // 初期状態: ソース選択
  if (status === "idle") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">
            画像を選択
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="text-3xl">📷</span>
              <span className="text-sm text-gray-600">カメラで撮影</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="text-3xl">🖼️</span>
              <span className="text-sm text-gray-600">ギャラリーから</span>
            </button>
          </div>

          <button
            onClick={handleCancel}
            className="w-full py-2 text-gray-600 hover:text-gray-900"
          >
            キャンセル
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    )
  }

  // アップロード中 / 処理中
  if (status === "uploading" || status === "processing") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-sm p-6">
          <div className="text-center">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-48 object-contain rounded-lg mb-4"
              />
            )}
            <div className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-blue-600"
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
              <span className="text-gray-600">
                {status === "uploading"
                  ? "アップロード中..."
                  : "テキスト抽出中..."}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // エラー
  if (status === "error") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-sm p-6">
          <div className="text-center">
            <span className="text-4xl">❌</span>
            <p className="mt-4 text-red-600">{error}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={reset} className="flex-1 btn-secondary">
                やり直す
              </button>
              <button onClick={handleCancel} className="flex-1 btn-primary">
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 完了: プレビューと確認
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900">プレビュー</h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full max-h-64 object-contain rounded-lg border"
            />
          )}

          {ocrText && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                抽出されたテキスト
              </h3>
              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 max-h-32 overflow-y-auto">
                {ocrText}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 text-center">
            この画像を使って質問しますか？
          </p>
        </div>

        <div className="p-4 border-t flex gap-2">
          <button onClick={handleCancel} className="flex-1 btn-secondary">
            キャンセル
          </button>
          <button onClick={handleConfirm} className="flex-1 btn-primary">
            この画像を使用
          </button>
        </div>
      </div>
    </div>
  )
}
