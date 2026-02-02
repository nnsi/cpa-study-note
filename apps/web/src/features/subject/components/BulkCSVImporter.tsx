import { useState, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { bulkImportCSV, type BulkCSVImportResult } from "@/features/study-domain/api"

type BulkCSVImporterProps = {
  domainId: string
  onClose: () => void
}

export function BulkCSVImporter({ domainId, onClose }: BulkCSVImporterProps) {
  const [csvContent, setCsvContent] = useState("")
  const [result, setResult] = useState<BulkCSVImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const importMutation = useMutation({
    mutationFn: (csv: string) => bulkImportCSV(domainId, csv),
    onSuccess: (data) => {
      setResult(data)
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["subjects"] })
      }
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === "string") {
        setCsvContent(content)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (!csvContent.trim()) return
    setResult(null)
    importMutation.mutate(csvContent)
  }

  const handleReset = () => {
    setCsvContent("")
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ink-100">
          <h2 className="heading-serif text-xl">4列CSVインポート</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ink-100 transition-colors text-ink-500"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Format guide */}
          <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
            <h3 className="font-medium text-indigo-800 flex items-center gap-2">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              CSVフォーマット
            </h3>
            <p className="text-sm text-indigo-700">
              4列のCSVファイルをインポートします。ヘッダー行は自動的にスキップされます。
            </p>
            <div className="bg-white rounded-lg p-3 font-mono text-sm text-ink-700">
              <div className="text-ink-500">科目名,大項目,中項目,小項目</div>
              <div>経営学,経営管理,経営管理の基礎,管理過程としての経営管理</div>
              <div>経営学,経営管理,経営管理の基礎,トップ・マネジメントの役割</div>
              <div>...</div>
            </div>
            <p className="text-xs text-indigo-600">
              * 同名の科目が存在する場合は追記モード、存在しない場合は新規作成されます
            </p>
          </div>

          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              CSVファイルを選択
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-ink-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer cursor-pointer"
            />
          </div>

          {/* Text area */}
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              または直接入力
            </label>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="科目名,大項目,中項目,小項目&#10;経営学,経営管理,経営管理の基礎,管理過程としての経営管理&#10;..."
              rows={8}
              className="w-full px-4 py-3 rounded-xl border border-ink-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none text-ink-800 placeholder:text-ink-400 font-mono text-sm resize-none"
            />
          </div>

          {/* Result */}
          {result && (
            <div
              className={`rounded-xl p-4 ${
                result.success
                  ? "bg-jade-50 border border-jade-200"
                  : "bg-amber-50 border border-amber-200"
              }`}
            >
              <h3
                className={`font-medium flex items-center gap-2 ${
                  result.success ? "text-jade-800" : "text-amber-800"
                }`}
              >
                {result.success ? (
                  <>
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    インポート完了
                  </>
                ) : (
                  <>
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    インポート結果
                  </>
                )}
              </h3>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {result.imported.subjects > 0 && (
                  <div className="bg-white rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {result.imported.subjects}
                    </div>
                    <div className="text-xs text-ink-500">新規科目</div>
                  </div>
                )}
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {result.imported.categories}
                  </div>
                  <div className="text-xs text-ink-500">カテゴリ</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {result.imported.subcategories}
                  </div>
                  <div className="text-xs text-ink-500">単元</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {result.imported.topics}
                  </div>
                  <div className="text-xs text-ink-500">論点</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-amber-800 mb-2">
                    エラー ({result.errors.length}件)
                  </h4>
                  <div className="bg-white rounded-lg p-3 max-h-32 overflow-y-auto">
                    {result.errors.map((error, i) => (
                      <div key={i} className="text-sm text-amber-700">
                        <span className="font-mono">行{error.line}:</span> {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {importMutation.error && (
            <div className="bg-crimson-50 border border-crimson-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-crimson-800">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span className="font-medium">エラー</span>
              </div>
              <p className="mt-2 text-sm text-crimson-700">
                {importMutation.error.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-ink-100">
          {result?.success ? (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg text-ink-600 hover:bg-ink-100 transition-colors"
              >
                別のファイルをインポート
              </button>
              <button onClick={onClose} className="btn-primary">
                閉じる
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-ink-600 hover:bg-ink-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={!csvContent.trim() || importMutation.isPending}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    インポート中...
                  </>
                ) : (
                  <>
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    インポート
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
