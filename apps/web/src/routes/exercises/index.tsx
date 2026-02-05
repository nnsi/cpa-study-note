import { useState, useCallback } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import {
  useExerciseAnalyze,
  useExerciseConfirm,
  ExerciseUploader,
  ExerciseSuggestions,
  ExerciseComplete,
} from "@/features/exercise"
import type { ViewTopicSearchResult, SearchTopicsResponse } from "@cpa-study/shared/schemas"

const searchParamsSchema = z.object({
  topicId: z.string().optional(),
})

export const Route = createFileRoute("/exercises/")({
  validateSearch: searchParamsSchema,
  component: ExercisePage,
})

type Step = "upload" | "suggestion" | "search" | "complete"

function ExercisePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>("upload")
  const [confirmedTopicName, setConfirmedTopicName] = useState<string | null>(null)
  const [confirmedTopicId, setConfirmedTopicId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSearchTopic, setSelectedSearchTopic] = useState<ViewTopicSearchResult | null>(null)

  const analyzeState = useExerciseAnalyze()
  const { confirm, isConfirming } = useExerciseConfirm()

  // 論点検索
  const { data: searchResults, isLoading: isSearching } = useQuery<SearchTopicsResponse>({
    queryKey: ["topicSearch", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { results: [], total: 0 }
      const res = await api.api.view.search.$get({
        query: { q: searchQuery, limit: "20" },
      })
      if (!res.ok) throw new Error("検索に失敗しました")
      return res.json() as Promise<SearchTopicsResponse>
    },
    enabled: step === "search" && searchQuery.trim().length > 0,
  })

  const handleFileSelect = useCallback(
    (file: File) => {
      analyzeState.analyze(file)
    },
    [analyzeState]
  )

  // 分析完了時にステップを進める
  if (analyzeState.status === "done" && step === "upload") {
    setStep("suggestion")
  }

  const handleConfirm = useCallback(
    (topicId: string, markAsUnderstood: boolean) => {
      if (!analyzeState.exerciseId) return

      const suggestedTopic = analyzeState.suggestedTopics.find((t) => t.topicId === topicId)
      const topicName = suggestedTopic?.topicName || selectedSearchTopic?.name || "論点"

      confirm(
        {
          exerciseId: analyzeState.exerciseId,
          topicId,
          markAsUnderstood,
        },
        {
          onSuccess: () => {
            setConfirmedTopicName(topicName)
            setConfirmedTopicId(topicId)
            setStep("complete")
          },
        }
      )
    },
    [analyzeState.exerciseId, analyzeState.suggestedTopics, selectedSearchTopic, confirm]
  )

  const handleSearchTopicSelect = useCallback(
    (topic: ViewTopicSearchResult) => {
      setSelectedSearchTopic(topic)
      // 検索結果から選択した論点で確定
      if (analyzeState.exerciseId) {
        confirm(
          {
            exerciseId: analyzeState.exerciseId,
            topicId: topic.id,
            markAsUnderstood: false,
          },
          {
            onSuccess: () => {
              setConfirmedTopicName(topic.name)
              setConfirmedTopicId(topic.id)
              setStep("complete")
            },
          }
        )
      }
    },
    [analyzeState.exerciseId, confirm]
  )

  const handleContinue = useCallback(() => {
    analyzeState.reset()
    setStep("upload")
    setSearchQuery("")
    setSelectedSearchTopic(null)
  }, [analyzeState])

  const handleViewTopic = useCallback(() => {
    if (confirmedTopicId) {
      // ホームに戻る（論点詳細への遷移はルーティング構造に依存）
      navigate({ to: "/" })
    }
  }, [confirmedTopicId, navigate])

  const handleBack = useCallback(() => {
    if (step === "search") {
      setStep("suggestion")
      setSearchQuery("")
    } else {
      navigate({ to: "/" })
    }
  }, [step, navigate])

  return (
    <div className="min-h-screen bg-ink-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-ink-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-1 -ml-1 text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-ink-900">
          {step === "search" ? "論点を検索" : "問題を追加"}
        </h1>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-lg mx-auto bg-white min-h-[calc(100vh-57px)]">
        {/* エラー表示 */}
        {analyzeState.error && (
          <div className="flex items-center gap-2 p-4 bg-crimson-50 text-crimson-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{analyzeState.error}</p>
          </div>
        )}

        {/* アップロード画面 */}
        {step === "upload" && (
          <ExerciseUploader
            onFileSelect={handleFileSelect}
            isAnalyzing={analyzeState.isAnalyzing}
            previewUrl={analyzeState.previewUrl}
          />
        )}

        {/* 論点提案画面 */}
        {step === "suggestion" && analyzeState.status === "done" && (
          <ExerciseSuggestions
            previewUrl={analyzeState.previewUrl}
            ocrText={analyzeState.ocrText}
            suggestedTopics={analyzeState.suggestedTopics}
            onConfirm={handleConfirm}
            onSearchClick={() => setStep("search")}
            isConfirming={isConfirming}
          />
        )}

        {/* 論点検索画面 */}
        {step === "search" && (
          <div className="p-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="論点名で検索..."
              className="w-full px-4 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />

            <div className="mt-4">
              {isSearching && <p className="text-sm text-ink-500">検索中...</p>}
              {searchResults && searchResults.results.length > 0 && (
                <div className="flex flex-col gap-2">
                  {searchResults.results.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => handleSearchTopicSelect(topic)}
                      disabled={isConfirming}
                      className="flex flex-col p-3 text-left rounded-lg border border-ink-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50"
                    >
                      <span className="font-medium text-ink-900">{topic.name}</span>
                      <span className="text-xs text-ink-500">
                        {topic.subjectName} / {topic.categoryName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults && searchResults.results.length === 0 && searchQuery.trim() && (
                <p className="text-sm text-ink-500">該当する論点が見つかりません</p>
              )}
            </div>
          </div>
        )}

        {/* 完了画面 */}
        {step === "complete" && confirmedTopicName && (
          <ExerciseComplete
            topicName={confirmedTopicName}
            onViewTopic={handleViewTopic}
            onContinue={handleContinue}
          />
        )}
      </main>
    </div>
  )
}
