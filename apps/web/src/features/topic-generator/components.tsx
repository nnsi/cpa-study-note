import { useState, useRef, useEffect } from "react"
import { useTopicSuggestion, useAddSuggestedTopics } from "./hooks"
import { toggleTopic, toggleCategory, type SelectionState } from "./logic"
import type { SuggestionsResult, CategorySuggestion } from "./logic"

// --- Sub-components ---

function PromptInput({
  onSubmit,
  isStreaming,
}: {
  onSubmit: (prompt: string) => void
  isStreaming: boolean
}) {
  const [prompt, setPrompt] = useState("")

  const handleSubmit = () => {
    const trimmed = prompt.trim()
    if (!trimmed || isStreaming) return
    onSubmit(trimmed)
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-ink-700">
        どのような論点を追加したいですか?
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        rows={3}
        placeholder="例: 財務会計の連結決算に関する論点を提案してください"
        className="w-full px-3 py-2 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
        disabled={isStreaming}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-400">Ctrl+Enter で送信</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isStreaming}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {isStreaming ? (
            <>
              <svg
                className="size-4 mr-1 animate-spin"
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
              生成中...
            </>
          ) : (
            <>
              <svg
                className="size-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                />
              </svg>
              提案してもらう
            </>
          )}
        </button>
      </div>
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

  if (!text) return null

  return (
    <div
      ref={containerRef}
      className="mt-4 p-4 bg-ink-50 rounded-xl max-h-48 overflow-y-auto"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="size-2 rounded-full bg-indigo-500 animate-pulse" />
        <span className="text-xs font-medium text-ink-500">AIが考えています...</span>
      </div>
      <pre className="text-xs text-ink-600 whitespace-pre-wrap font-mono leading-relaxed">
        {text}
      </pre>
    </div>
  )
}

function TopicItem({
  name,
  description,
  isSelected,
  onToggle,
}: {
  name: string
  description: string | null
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-ink-50 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="mt-0.5 size-4 rounded border-ink-300 text-indigo-600 focus:ring-indigo-500"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-ink-800">{name}</span>
        {description && (
          <p className="text-xs text-ink-500 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  )
}

function CategoryGroup({
  category,
  selection,
  onToggleTopic,
  onToggleCategory,
}: {
  category: CategorySuggestion
  selection: SelectionState
  onToggleTopic: (categoryName: string, topicName: string) => void
  onToggleCategory: (categoryName: string, allTopics: string[]) => void
}) {
  const selectedTopics = selection.get(category.name) ?? new Set()
  const allTopicNames = category.topics.map((t) => t.name)
  const allSelected = selectedTopics.size === allTopicNames.length
  const someSelected = selectedTopics.size > 0 && !allSelected

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected
            }}
            onChange={() => onToggleCategory(category.name, allTopicNames)}
            className="size-4 rounded border-ink-300 text-indigo-600 focus:ring-indigo-500"
          />
          <svg
            className="size-4 text-jade-600"
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
          <span className="font-medium text-sm text-ink-800">
            {category.name}
          </span>
          <span className="text-xs text-ink-500">
            ({selectedTopics.size}/{category.topics.length})
          </span>
        </label>
      </div>
      <div className="ml-6 space-y-0.5">
        {category.topics.map((topic) => (
          <TopicItem
            key={topic.name}
            name={topic.name}
            description={topic.description}
            isSelected={selectedTopics.has(topic.name)}
            onToggle={() => onToggleTopic(category.name, topic.name)}
          />
        ))}
      </div>
    </div>
  )
}

function SuggestionsView({
  suggestions,
  selection,
  onSelectionChange,
}: {
  suggestions: SuggestionsResult
  selection: SelectionState
  onSelectionChange: (selection: SelectionState) => void
}) {
  const handleToggleTopic = (categoryName: string, topicName: string) => {
    onSelectionChange(toggleTopic(selection, categoryName, topicName))
  }

  const handleToggleCategory = (categoryName: string, allTopics: string[]) => {
    onSelectionChange(toggleCategory(selection, categoryName, allTopics))
  }

  return (
    <div className="mt-4 space-y-4 animate-fade-in">
      <h3 className="text-sm font-medium text-ink-700">提案された論点</h3>
      <div className="space-y-4">
        {suggestions.categories.map((category) => (
          <CategoryGroup
            key={category.name}
            category={category}
            selection={selection}
            onToggleTopic={handleToggleTopic}
            onToggleCategory={handleToggleCategory}
          />
        ))}
      </div>
    </div>
  )
}

// --- Main Modal ---

type TopicGeneratorModalProps = {
  subjectId: string
  onClose: () => void
  onComplete: () => void
}

export function TopicGeneratorModal({
  subjectId,
  onClose,
  onComplete,
}: TopicGeneratorModalProps) {
  const {
    streamingText,
    isStreaming,
    suggestions,
    selection,
    setSelection,
    error,
    suggest,
    abort,
    selectedCount,
  } = useTopicSuggestion(subjectId)

  const addMutation = useAddSuggestedTopics(subjectId)

  const handleClose = () => {
    abort()
    onClose()
  }

  const handleAdd = async () => {
    if (!suggestions || selectedCount === 0) return
    try {
      await addMutation.mutateAsync({ suggestions, selection })
      onComplete()
    } catch {
      // エラーはmutationのstateで表示
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
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
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
              />
            </svg>
            <h2 className="heading-serif text-xl">AIで論点を追加</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-ink-100 rounded transition-colors text-ink-500"
            aria-label="閉じる"
          >
            <svg
              className="size-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <PromptInput onSubmit={suggest} isStreaming={isStreaming} />

          {isStreaming && <StreamingView text={streamingText} />}

          {error && (
            <div className="mt-4 p-3 bg-crimson-50 border border-crimson-200 rounded-lg text-crimson-700 text-sm">
              {error}
            </div>
          )}

          {addMutation.error && (
            <div className="mt-4 p-3 bg-crimson-50 border border-crimson-200 rounded-lg text-crimson-700 text-sm">
              {addMutation.error instanceof Error
                ? addMutation.error.message
                : "追加に失敗しました"}
            </div>
          )}

          {suggestions && !isStreaming && (
            <SuggestionsView
              suggestions={suggestions}
              selection={selection}
              onSelectionChange={setSelection}
            />
          )}
        </div>

        {/* Footer */}
        {suggestions && !isStreaming && (
          <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-between shrink-0">
            <span className="text-sm text-ink-500">
              {selectedCount} 件の論点を選択中
            </span>
            <div className="flex gap-3">
              <button type="button" onClick={handleClose} className="btn-secondary">
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={selectedCount === 0 || addMutation.isPending}
                className="btn-primary disabled:opacity-50"
              >
                {addMutation.isPending ? (
                  <>
                    <svg
                      className="size-4 mr-1 animate-spin"
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
                    追加中...
                  </>
                ) : (
                  `${selectedCount} 件の論点を追加する`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
