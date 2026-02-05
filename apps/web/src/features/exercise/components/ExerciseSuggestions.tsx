import { useState } from "react"
import { Check, ChevronRight, Search, Loader2 } from "lucide-react"
import type { SuggestedTopic } from "@cpa-study/shared/schemas"

type ExerciseSuggestionsProps = {
  previewUrl: string | null
  ocrText: string | null
  suggestedTopics: SuggestedTopic[]
  onConfirm: (topicId: string, markAsUnderstood: boolean) => void
  onSearchClick: () => void
  isConfirming: boolean
}

const confidenceLabel = {
  high: "推奨",
  medium: "",
  low: "",
}

const confidenceStyle = {
  high: "bg-jade-100 text-jade-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-ink-100 text-ink-600",
}

export const ExerciseSuggestions = ({
  previewUrl,
  ocrText,
  suggestedTopics,
  onConfirm,
  onSearchClick,
  isConfirming,
}: ExerciseSuggestionsProps) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    suggestedTopics[0]?.topicId || null
  )
  const [markAsUnderstood, setMarkAsUnderstood] = useState(false)

  const handleConfirm = () => {
    if (selectedTopicId) {
      onConfirm(selectedTopicId, markAsUnderstood)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 画像サムネイル */}
      {previewUrl && (
        <div className="flex justify-center">
          <img
            src={previewUrl}
            alt="アップロードした問題画像"
            className="max-h-32 rounded-lg border border-ink-200 object-contain"
          />
        </div>
      )}

      {/* OCR結果 */}
      {ocrText && (
        <div className="bg-ink-50 rounded-lg p-3">
          <p className="text-xs text-ink-500 mb-1">OCR結果:</p>
          <p className="text-sm text-ink-700 line-clamp-3">{ocrText}</p>
        </div>
      )}

      {/* 論点提案 */}
      <div className="border-t border-ink-200 pt-4">
        <h3 className="text-sm font-semibold text-ink-700 mb-3">この問題の論点は？</h3>

        <div className="flex flex-col gap-2">
          {suggestedTopics.map((topic) => (
            <button
              key={topic.topicId}
              onClick={() => setSelectedTopicId(topic.topicId)}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                selectedTopicId === topic.topicId
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-ink-200 hover:border-ink-300"
              }`}
            >
              <div
                className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedTopicId === topic.topicId
                    ? "border-indigo-500 bg-indigo-500"
                    : "border-ink-300"
                }`}
              >
                {selectedTopicId === topic.topicId && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900">{topic.topicName}</span>
                  {confidenceLabel[topic.confidence] && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${confidenceStyle[topic.confidence]}`}
                    >
                      {confidenceLabel[topic.confidence]}
                    </span>
                  )}
                </div>
                <span className="text-xs text-ink-500">（{topic.subjectName}）</span>
                <p className="text-xs text-ink-600 mt-1">{topic.reason}</p>
              </div>
            </button>
          ))}

          {/* 別の論点を選ぶ */}
          <button
            onClick={onSearchClick}
            className="flex items-center gap-3 p-3 rounded-lg border-2 border-ink-200 hover:border-ink-300 transition-all text-left"
          >
            <Search className="h-5 w-5 text-ink-400" />
            <span className="text-ink-600">別の論点を選ぶ...</span>
            <ChevronRight className="h-4 w-4 text-ink-400 ml-auto" />
          </button>
        </div>
      </div>

      {/* 理解済みチェック */}
      <div className="border-t border-ink-200 pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={markAsUnderstood}
            onChange={(e) => setMarkAsUnderstood(e.target.checked)}
            className="w-5 h-5 rounded border-ink-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-ink-700">この論点は理解した</span>
        </label>
      </div>

      {/* 確定ボタン */}
      <button
        onClick={handleConfirm}
        disabled={!selectedTopicId || isConfirming}
        className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isConfirming ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            確定中...
          </>
        ) : (
          "確定する"
        )}
      </button>
    </div>
  )
}
