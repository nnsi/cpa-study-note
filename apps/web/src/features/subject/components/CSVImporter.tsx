import { useState, useRef } from "react"

type CSVImporterProps = {
  onImport: (csvContent: string) => Promise<{
    success: boolean
    imported: { categories: number; topics: number }
    errors: Array<{ line: number; message: string }>
  }>
  onClose: () => void
  isLoading: boolean
}

export function CSVImporter({ onImport, onClose, isLoading }: CSVImporterProps) {
  const [csvContent, setCsvContent] = useState("")
  const [result, setResult] = useState<{
    success: boolean
    imported: { categories: number; topics: number }
    errors: Array<{ line: number; message: string }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      setCsvContent(text)
      setResult(null)
      setError(null)
    } catch (err) {
      setError("ファイルの読み込みに失敗しました")
    }
  }

  const handleImport = async () => {
    if (!csvContent.trim()) {
      setError("CSVデータを入力してください")
      return
    }

    try {
      setError(null)
      const importResult = await onImport(csvContent)
      setResult(importResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました")
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
          <h2 className="heading-serif text-xl">CSVインポート</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-ink-100 rounded transition-colors text-ink-500"
            aria-label="閉じる"
          >
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Format guide */}
          <div className="mb-4 p-4 bg-indigo-50 rounded-xl">
            <h3 className="font-medium text-indigo-900 mb-2">CSV形式</h3>
            <p className="text-sm text-indigo-700 mb-2">
              3列のCSVファイルをインポートできます:
            </p>
            <pre className="text-xs bg-white/50 p-2 rounded font-mono text-indigo-800">
              科目,カテゴリ,論点{"\n"}
              財務会計,資産会計,棚卸資産の評価{"\n"}
              財務会計,資産会計,有価証券の評価{"\n"}
              財務会計,負債会計,引当金の計上
            </pre>
            <p className="text-xs text-indigo-600 mt-2">
              * ヘッダー行は自動でスキップされます
              <br />
              * この科目に一致する行のみがインポートされます
              <br />
              * 既存の同名カテゴリには追加されます
            </p>
          </div>

          {/* File input */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary w-full"
            >
              <svg className="size-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              CSVファイルを選択
            </button>
          </div>

          {/* Text area */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-700 mb-1">
              またはCSVデータを直接入力
            </label>
            <textarea
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value)
                setResult(null)
                setError(null)
              }}
              rows={8}
              placeholder="科目,カテゴリ,論点&#10;財務会計,資産会計,棚卸資産の評価&#10;..."
              className="w-full px-3 py-2 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-crimson-50 border border-crimson-200 rounded-lg text-crimson-700 text-sm">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`mb-4 p-4 rounded-lg ${result.success ? "bg-jade-50 border border-jade-200" : "bg-amber-50 border border-amber-200"}`}>
              <h4 className={`font-medium mb-2 ${result.success ? "text-jade-800" : "text-amber-800"}`}>
                インポート結果
              </h4>
              <div className="text-sm space-y-1">
                <p className={result.success ? "text-jade-700" : "text-amber-700"}>
                  カテゴリ: {result.imported.categories} 件
                </p>
                <p className={result.success ? "text-jade-700" : "text-amber-700"}>
                  論点: {result.imported.topics} 件
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-amber-800 font-medium text-sm mb-1">
                    エラー ({result.errors.length} 件)
                  </p>
                  <ul className="text-xs text-amber-700 space-y-0.5 max-h-24 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>
                        行 {err.line}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ink-100 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            {result ? "閉じる" : "キャンセル"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleImport}
              disabled={isLoading || !csvContent.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="size-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  インポート中...
                </>
              ) : (
                "インポート"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
