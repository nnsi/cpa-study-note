import { useRef, type ChangeEvent } from "react"
import { Camera, ImageIcon, Loader2 } from "lucide-react"

type ExerciseUploaderProps = {
  onFileSelect: (file: File) => void
  isAnalyzing: boolean
  previewUrl: string | null
}

export const ExerciseUploader = ({
  onFileSelect,
  isAnalyzing,
  previewUrl,
}: ExerciseUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleGalleryClick = () => {
    fileInputRef.current?.click()
  }

  const handleCameraClick = () => {
    cameraInputRef.current?.click()
  }

  if (isAnalyzing || previewUrl) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        {previewUrl && (
          <div className="relative w-full max-w-sm">
            <img
              src={previewUrl}
              alt="アップロード中の画像"
              className="w-full rounded-lg border border-ink-200"
            />
            {isAnalyzing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <span className="text-sm text-ink-600">分析中...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <h2 className="text-lg font-semibold text-ink-900">問題画像をアップロード</h2>

      {/* ファイル選択エリア */}
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-3">
          {/* カメラ撮影ボタン */}
          <button
            onClick={handleCameraClick}
            className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <Camera className="h-6 w-6 text-indigo-600" />
            <span className="text-indigo-700 font-medium">カメラで撮影</span>
          </button>

          {/* ギャラリー選択ボタン */}
          <button
            onClick={handleGalleryClick}
            className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-lg border-2 border-dashed border-ink-300 bg-ink-50 hover:bg-ink-100 transition-colors"
          >
            <ImageIcon className="h-6 w-6 text-ink-600" />
            <span className="text-ink-700 font-medium">画像を選択</span>
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <p className="text-sm text-ink-500 text-center">
        JPEG, PNG, GIF, WebP形式（最大10MB）
      </p>
    </div>
  )
}
