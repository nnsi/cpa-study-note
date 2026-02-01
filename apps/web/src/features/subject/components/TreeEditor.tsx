import { useEffect, useState } from "react"
import { useTreeState } from "../hooks/useTreeState"
import { useSubjectTree, useUpdateSubjectTree, useImportCSV } from "../hooks/useSubjects"
import type { TopicNodeInput } from "../api"
import { TreeNode } from "./TreeNode"
import { TopicDetailEditor } from "./TopicDetailEditor"
import { CSVImporter } from "./CSVImporter"

type TreeEditorProps = {
  subjectId: string
  subjectName: string
}

export function TreeEditor({ subjectId, subjectName }: TreeEditorProps) {
  const { tree, isLoading, error, refetch } = useSubjectTree(subjectId)
  const updateTreeMutation = useUpdateSubjectTree()
  const importCSVMutation = useImportCSV()

  const treeState = useTreeState(tree?.categories ?? [])
  const [selectedTopic, setSelectedTopic] = useState<{
    categoryIdx: number
    topicIdx: number
    topic: TopicNodeInput
  } | null>(null)
  const [showCSVImporter, setShowCSVImporter] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Reset tree state when API data changes
  useEffect(() => {
    if (tree?.categories) {
      treeState.resetFromApi(tree.categories)
    }
  }, [tree])

  const handleSave = async () => {
    try {
      setSaveMessage(null)
      await updateTreeMutation.mutateAsync({
        id: subjectId,
        tree: treeState.getUpdatePayload(),
      })
      setSaveMessage({ type: "success", text: "保存しました" })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "保存に失敗しました",
      })
    }
  }

  const handleCSVImport = async (csvContent: string) => {
    try {
      const result = await importCSVMutation.mutateAsync({
        id: subjectId,
        csvContent,
      })
      setShowCSVImporter(false)
      await refetch()
      return result
    } catch (err) {
      throw err
    }
  }

  const handleTopicSelect = (categoryIdx: number, topicIdx: number) => {
    const topic = treeState.categories[categoryIdx]?.topics[topicIdx]
    if (topic) {
      setSelectedTopic({ categoryIdx, topicIdx, topic })
    }
  }

  const handleTopicUpdate = (updates: Partial<TopicNodeInput>) => {
    if (selectedTopic) {
      treeState.updateTopic(
        selectedTopic.categoryIdx,
        selectedTopic.topicIdx,
        updates
      )
      setSelectedTopic((prev) =>
        prev ? { ...prev, topic: { ...prev.topic, ...updates } } : null
      )
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 skeleton rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-crimson-600">
        ツリーの読み込みに失敗しました: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => treeState.addCategory()}
            className="btn-secondary text-sm"
          >
            <svg className="size-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            カテゴリを追加
          </button>
          <button
            type="button"
            onClick={() => setShowCSVImporter(true)}
            className="btn-secondary text-sm"
          >
            <svg className="size-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            CSVインポート
          </button>
        </div>

        <div className="flex items-center gap-3">
          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.type === "success" ? "text-jade-600" : "text-crimson-600"
              }`}
            >
              {saveMessage.text}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!treeState.isDirty || updateTreeMutation.isPending}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {updateTreeMutation.isPending ? (
              <>
                <svg className="size-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                保存中...
              </>
            ) : (
              <>
                <svg className="size-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                保存
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tree display */}
      {treeState.categories.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mx-auto mb-6">
            <svg className="size-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </div>
          <h3 className="heading-serif text-lg text-ink-700 mb-2">
            カテゴリがありません
          </h3>
          <p className="text-sm text-ink-500 mb-6">
            「カテゴリを追加」ボタンまたはCSVインポートでカテゴリ・論点を追加してください
          </p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Tree */}
          <div className="flex-1 space-y-3">
            {treeState.categories.map((category, categoryIdx) => (
              <TreeNode
                key={category.id ?? `new-${categoryIdx}`}
                category={category}
                categoryIdx={categoryIdx}
                onUpdateCategory={(name) => treeState.updateCategory(categoryIdx, name)}
                onDeleteCategory={() => treeState.deleteCategory(categoryIdx)}
                onAddTopic={() => treeState.addTopic(categoryIdx)}
                onUpdateTopic={(topicIdx, updates) =>
                  treeState.updateTopic(categoryIdx, topicIdx, updates)
                }
                onDeleteTopic={(topicIdx) =>
                  treeState.deleteTopic(categoryIdx, topicIdx)
                }
                onSelectTopic={(topicIdx) =>
                  handleTopicSelect(categoryIdx, topicIdx)
                }
                selectedTopicId={
                  selectedTopic?.categoryIdx === categoryIdx
                    ? String(selectedTopic.topicIdx)
                    : null
                }
                onMoveCategory={(toIdx) => treeState.moveCategory(categoryIdx, toIdx)}
                onMoveTopic={(fromTopicIdx, toTopicIdx) =>
                  treeState.moveTopic(categoryIdx, fromTopicIdx, toTopicIdx)
                }
                totalCategories={treeState.categories.length}
              />
            ))}
          </div>

          {/* Topic detail panel */}
          {selectedTopic && (
            <div className="w-80 shrink-0">
              <TopicDetailEditor
                topic={selectedTopic.topic}
                onUpdate={handleTopicUpdate}
                onClose={() => setSelectedTopic(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* CSV Importer Modal */}
      {showCSVImporter && (
        <CSVImporter
          onImport={handleCSVImport}
          onClose={() => setShowCSVImporter(false)}
          isLoading={importCSVMutation.isPending}
        />
      )}
    </div>
  )
}
