import { useEffect, useRef, type ChangeEvent } from "react"
import {
  useApplyTocSuggestions,
  useTocImages,
  useTocSuggestion,
} from "../hooks"
import {
  renameNode,
  toggleNode,
  type EditableCategory,
  type EditableSubcategory,
  type EditableTopic,
} from "../logic"

type TocImportModalProps = {
  subjectId: string
  onClose: () => void
  onComplete: () => void
}

const Spinner = () => (
  <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
)

const ErrorMessage = ({ children }: { children: React.ReactNode }) => (
  <div className="p-3 bg-crimson-50 border border-crimson-200 rounded-lg text-crimson-700 text-sm">
    {children}
  </div>
)

function ImageSelection({
  images,
  error,
  onFiles,
  onRemove,
  onMove,
}: {
  images: ReturnType<typeof useTocImages>["images"]
  error: string | null
  onFiles: (files: File[]) => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h3 className="text-sm font-medium text-ink-700">目次の写真を選択</h3>
        <p className="mt-1 text-xs text-ink-500">
          ページ順に最大5枚まで選択できます。画像はアップロード前に縮小されます。
        </p>
      </div>

      {images.length < 5 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center gap-2 p-8 border-2 border-dashed border-ink-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
        >
          <svg
            className="size-8 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z"
            />
          </svg>
          <span className="text-sm font-medium text-ink-700">
            写真を撮影・選択
          </span>
          <span className="text-xs text-ink-400">JPEG / PNG / WebP</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {images.length > 0 && (
        <div className="space-y-2">
          {images.map((image, index) => (
            <div
              key={image.key}
              className="flex items-center gap-3 p-3 border border-ink-100 rounded-xl bg-white"
            >
              <div className="relative shrink-0">
                <img
                  src={image.previewUrl}
                  alt={`目次 ${index + 1}ページ目`}
                  className="size-16 object-cover rounded-lg bg-ink-50"
                />
                <span className="absolute -top-1.5 -left-1.5 size-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-700 truncate">{image.file.name}</p>
                {image.status === "uploading" && (
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-indigo-600">
                    <Spinner /> アップロード中...
                  </span>
                )}
                {image.status === "done" && (
                  <span className="mt-1 text-xs text-jade-600">アップロード済み</span>
                )}
                {image.status === "error" && (
                  <span className="mt-1 block text-xs text-crimson-600">
                    {image.error ?? "アップロードに失敗しました"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMove(index, index - 1)}
                  disabled={index === 0}
                  className="p-1.5 rounded hover:bg-ink-100 text-ink-500 disabled:opacity-25"
                  aria-label="前のページへ移動"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, index + 1)}
                  disabled={index === images.length - 1}
                  className="p-1.5 rounded hover:bg-ink-100 text-ink-500 disabled:opacity-25"
                  aria-label="次のページへ移動"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="p-1.5 rounded hover:bg-crimson-50 text-crimson-500"
                  aria-label="画像を削除"
                >
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  )
}

function StreamingView({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col items-center py-5 text-center">
        <div className="size-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Spinner />
        </div>
        <h3 className="mt-3 text-sm font-medium text-ink-700">目次を解析しています</h3>
        <p className="mt-1 text-xs text-ink-500">ページ数により少し時間がかかります。</p>
      </div>
      <div ref={containerRef} className="p-4 bg-ink-50 rounded-xl max-h-64 overflow-y-auto">
        <pre className="text-xs text-ink-600 whitespace-pre-wrap font-mono leading-relaxed">
          {text || "AIからの応答を待っています..."}
        </pre>
      </div>
    </div>
  )
}

function NameInput({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      maxLength={200}
      onChange={(event) => onChange(event.target.value)}
      className={`min-w-0 px-2 py-1 rounded border border-transparent hover:border-ink-200 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${className ?? ""}`}
      aria-label={`${value}の名前`}
    />
  )
}

function TopicRow({
  topic,
  onToggle,
  onRename,
}: {
  topic: EditableTopic
  onToggle: (key: string) => void
  onRename: (key: string, name: string) => void
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-ink-50">
      <input
        type="checkbox"
        checked={topic.selected}
        onChange={() => onToggle(topic.key)}
        className="size-4 rounded border-ink-300 text-indigo-600 focus:ring-indigo-500"
        aria-label={`${topic.name}を選択`}
      />
      <NameInput
        value={topic.name}
        onChange={(name) => onRename(topic.key, name)}
        className="flex-1 text-sm text-ink-700"
      />
    </div>
  )
}

function SubcategoryGroup({
  subcategory,
  onToggle,
  onRename,
}: {
  subcategory: EditableSubcategory
  onToggle: (key: string) => void
  onRename: (key: string, name: string) => void
}) {
  const selectedCount = subcategory.topics.filter((topic) => topic.selected).length
  const partiallySelected =
    selectedCount > 0 && selectedCount < subcategory.topics.length

  return (
    <div className="ml-5 border-l border-ink-100 pl-3">
      <div className="flex items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={subcategory.selected}
          ref={(element) => {
            if (element) element.indeterminate = partiallySelected
          }}
          onChange={() => onToggle(subcategory.key)}
          className="size-4 rounded border-ink-300 text-indigo-600 focus:ring-indigo-500"
          aria-label={`${subcategory.name}を選択`}
        />
        <NameInput
          value={subcategory.name}
          onChange={(name) => onRename(subcategory.key, name)}
          className="flex-1 text-sm font-medium text-ink-700"
        />
        <span className="text-xs text-ink-400">
          {selectedCount}/{subcategory.topics.length}
        </span>
      </div>
      <div className="ml-5">
        {subcategory.topics.map((topic) => (
          <TopicRow
            key={topic.key}
            topic={topic}
            onToggle={onToggle}
            onRename={onRename}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryGroup({
  category,
  onToggle,
  onRename,
}: {
  category: EditableCategory
  onToggle: (key: string) => void
  onRename: (key: string, name: string) => void
}) {
  const topics = category.subcategories.flatMap((subcategory) => subcategory.topics)
  const selectedCount = topics.filter((topic) => topic.selected).length
  const partiallySelected = selectedCount > 0 && selectedCount < topics.length

  return (
    <div className="p-3 border border-ink-100 rounded-xl animate-fade-in-up">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={category.selected}
          ref={(element) => {
            if (element) element.indeterminate = partiallySelected
          }}
          onChange={() => onToggle(category.key)}
          className="size-4 rounded border-ink-300 text-indigo-600 focus:ring-indigo-500"
          aria-label={`${category.name}を選択`}
        />
        <svg
          className="size-4 shrink-0 text-jade-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
          />
        </svg>
        <NameInput
          value={category.name}
          onChange={(name) => onRename(category.key, name)}
          className="flex-1 text-sm font-semibold text-ink-800"
        />
        <span className="text-xs text-ink-400">
          {selectedCount}/{topics.length}
        </span>
      </div>
      <div className="mt-1 space-y-2">
        {category.subcategories.map((subcategory) => (
          <SubcategoryGroup
            key={subcategory.key}
            subcategory={subcategory}
            onToggle={onToggle}
            onRename={onRename}
          />
        ))}
      </div>
    </div>
  )
}

function TreePreview({
  tree,
  onChange,
}: {
  tree: EditableCategory[]
  onChange: (tree: EditableCategory[]) => void
}) {
  return (
    <div className="space-y-3 animate-fade-in">
      <div>
        <h3 className="text-sm font-medium text-ink-700">解析結果を確認</h3>
        <p className="mt-1 text-xs text-ink-500">
          登録しない項目はチェックを外し、名前は直接編集してください。
        </p>
      </div>
      {tree.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-500 bg-ink-50 rounded-xl">
          登録できる項目が見つかりませんでした。
        </div>
      ) : (
        <div className="space-y-3">
          {tree.map((category) => (
            <CategoryGroup
              key={category.key}
              category={category}
              onToggle={(key) => onChange(toggleNode(tree, key))}
              onRename={(key, name) => onChange(renameNode(tree, key, name))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TocImportModal({
  subjectId,
  onClose,
  onComplete,
}: TocImportModalProps) {
  const { images, error: imageError, addFiles, remove, move } = useTocImages()
  const {
    streamingText,
    isStreaming,
    tree,
    setTree,
    error: suggestionError,
    suggest,
    abort,
    selectedCount,
  } = useTocSuggestion(subjectId)
  const applyMutation = useApplyTocSuggestions(subjectId)

  const imageIds = images.flatMap((image) =>
    image.status === "done" && image.imageId ? [image.imageId] : []
  )
  const canAnalyze =
    images.length > 0 && images.every((image) => image.status === "done")
  const step = applyMutation.isPending ? 4 : tree ? 3 : isStreaming ? 2 : 1

  const handleClose = () => {
    abort()
    onClose()
  }

  const handleAnalyze = () => {
    if (canAnalyze) void suggest(imageIds)
  }

  const handleApply = async () => {
    if (!tree || selectedCount === 0) return
    try {
      await applyMutation.mutateAsync(tree)
      onComplete()
    } catch {
      // エラー表示はmutationのstateを使用する。
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
        <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <svg
                className="size-5 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3.75h10.5a2.25 2.25 0 0 1 2.25 2.25v12a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25Zm1.5 4.5h7.5m-7.5 3.75h7.5m-7.5 3.75h4.5"
                />
              </svg>
              <h2 className="heading-serif text-xl">目次から取り込み</h2>
            </div>
            <p className="mt-1 text-xs text-ink-400">ステップ {step} / 4</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-ink-100 rounded transition-colors text-ink-500"
            aria-label="閉じる"
          >
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {applyMutation.isPending ? (
            <div className="py-16 flex flex-col items-center text-center">
              <div className="size-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Spinner />
              </div>
              <h3 className="mt-3 text-sm font-medium text-ink-700">論点を登録しています</h3>
            </div>
          ) : isStreaming ? (
            <StreamingView text={streamingText} />
          ) : tree ? (
            <TreePreview tree={tree} onChange={setTree} />
          ) : (
            <div className="space-y-4">
              <ImageSelection
                images={images}
                error={imageError}
                onFiles={addFiles}
                onRemove={remove}
                onMove={move}
              />
              {suggestionError && (
                <ErrorMessage>
                  <p>{suggestionError}</p>
                  {streamingText && (
                    <pre className="mt-3 p-3 bg-white/70 rounded text-xs text-ink-600 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                      {streamingText}
                    </pre>
                  )}
                </ErrorMessage>
              )}
            </div>
          )}

          {applyMutation.error && !applyMutation.isPending && (
            <div className="mt-4">
              <ErrorMessage>
                {applyMutation.error instanceof Error
                  ? applyMutation.error.message
                  : "論点の登録に失敗しました"}
              </ErrorMessage>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-between shrink-0">
          {step === 1 && (
            <>
              <span className="text-sm text-ink-500">{images.length} / 5 枚</span>
              <div className="flex gap-3">
                <button type="button" onClick={handleClose} className="btn-secondary">
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze}
                  className="btn-primary disabled:opacity-50"
                >
                  {suggestionError ? "再解析" : "解析を開始"}
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <span className="text-sm text-ink-500">AIが解析中です</span>
              <button type="button" onClick={abort} className="btn-secondary">
                中断
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <span className="text-sm text-ink-500">
                {selectedCount} 件の論点を選択中
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void suggest(imageIds)}
                  className="btn-secondary"
                >
                  再解析
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={selectedCount === 0}
                  className="btn-primary disabled:opacity-50"
                >
                  {selectedCount} 論点を登録
                </button>
              </div>
            </>
          )}
          {step === 4 && (
            <span className="text-sm text-ink-500">登録が完了するまでお待ちください</span>
          )}
        </div>
      </div>
    </div>
  )
}
