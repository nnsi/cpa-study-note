import type { TopicNodeInput } from "../api"

type TopicDetailEditorProps = {
  topic: TopicNodeInput
  onUpdate: (updates: Partial<TopicNodeInput>) => void
  onClose: () => void
}

export function TopicDetailEditor({ topic, onUpdate, onClose }: TopicDetailEditorProps) {
  return (
    <div className="card sticky top-4">
      <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
        <h3 className="font-semibold text-ink-900">論点の詳細</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-ink-100 rounded transition-colors text-ink-500"
          aria-label="閉じる"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            論点名
          </label>
          <input
            type="text"
            value={topic.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            難易度
          </label>
          <select
            value={topic.difficulty ?? ""}
            onChange={(e) =>
              onUpdate({
                difficulty: (e.target.value || null) as TopicNodeInput["difficulty"],
              })
            }
            className="w-full px-3 py-2 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">未設定</option>
            <option value="basic">基礎</option>
            <option value="intermediate">標準</option>
            <option value="advanced">応用</option>
          </select>
        </div>

        {/* Topic Type */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            論点タイプ
          </label>
          <input
            type="text"
            value={topic.topicType ?? ""}
            onChange={(e) => onUpdate({ topicType: e.target.value || null })}
            placeholder="例: 計算、理論、事例"
            className="w-full px-3 py-2 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            説明
          </label>
          <textarea
            value={topic.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value || null })}
            rows={3}
            placeholder="この論点の補足説明..."
            className="w-full px-3 py-2 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        {/* AI System Prompt */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">
            AIシステムプロンプト
          </label>
          <textarea
            value={topic.aiSystemPrompt ?? ""}
            onChange={(e) => onUpdate({ aiSystemPrompt: e.target.value || null })}
            rows={4}
            placeholder="この論点でAIチャットする際の追加指示..."
            className="w-full px-3 py-2 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
          />
          <p className="mt-1 text-xs text-ink-400">
            AIチャット時に自動で追加されるシステムプロンプトです
          </p>
        </div>
      </div>
    </div>
  )
}
