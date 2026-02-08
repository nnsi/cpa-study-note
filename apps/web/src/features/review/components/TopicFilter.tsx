import type { TopicFilterParams } from "../api"

type TopicFilterProps = {
  filters: TopicFilterParams
  onUpdateFilter: <K extends keyof TopicFilterParams>(
    key: K,
    value: TopicFilterParams[K]
  ) => void
  onApply: () => void
  onReset: () => void
  isLoading: boolean
}

export const TopicFilter = ({
  filters,
  onUpdateFilter,
  onApply,
  onReset,
  isLoading,
}: TopicFilterProps) => {
  return (
    <div className="card p-5 space-y-5">
      <h2 className="text-lg font-semibold text-ink-900">フィルタ条件</h2>

      {/* チェック状態 */}
      <div>
        <label className="block text-sm font-medium text-ink-700 mb-2">
          チェック状態
        </label>
        <div className="flex flex-wrap gap-2">
          <FilterButton
            active={filters.understood === undefined}
            onClick={() => onUpdateFilter("understood", undefined)}
          >
            すべて
          </FilterButton>
          <FilterButton
            active={filters.understood === true}
            onClick={() => onUpdateFilter("understood", true)}
          >
            チェック済み
          </FilterButton>
          <FilterButton
            active={filters.understood === false}
            onClick={() => onUpdateFilter("understood", false)}
          >
            未チェック
          </FilterButton>
        </div>
      </div>

      {/* セッション数 */}
      <div>
        <label className="block text-sm font-medium text-ink-700 mb-2">
          セッション数
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={filters.minSessionCount ?? ""}
            onChange={(e) =>
              onUpdateFilter(
                "minSessionCount",
                e.target.value ? parseInt(e.target.value, 10) : undefined
              )
            }
            placeholder="0"
            className="input-field w-20 text-sm"
          />
          <span className="text-sm text-ink-600">件以上</span>
        </div>
      </div>

      {/* 最終チャットからの経過日数 */}
      <div>
        <label className="block text-sm font-medium text-ink-700 mb-2">
          最終チャットからの経過日数
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={filters.daysSinceLastChat ?? ""}
            onChange={(e) =>
              onUpdateFilter(
                "daysSinceLastChat",
                e.target.value ? parseInt(e.target.value, 10) : undefined
              )
            }
            placeholder="0"
            className="input-field w-20 text-sm"
          />
          <span className="text-sm text-ink-600">日以上</span>
        </div>
      </div>

      {/* 良質な質問数 */}
      <div>
        <label className="block text-sm font-medium text-ink-700 mb-2">
          良質な質問数
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={filters.minGoodQuestionCount ?? ""}
            onChange={(e) =>
              onUpdateFilter(
                "minGoodQuestionCount",
                e.target.value ? parseInt(e.target.value, 10) : undefined
              )
            }
            placeholder="0"
            className="input-field w-20 text-sm"
          />
          <span className="text-sm text-ink-600">件以上</span>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onApply}
          disabled={isLoading}
          className="flex-1 btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "検索中..." : "検索"}
        </button>
        <button
          onClick={onReset}
          className="btn-ghost py-2.5"
        >
          リセット
        </button>
      </div>
    </div>
  )
}

type FilterButtonProps = {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

const FilterButton = ({ active, onClick, children }: FilterButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
        active
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50"
      }`}
    >
      {children}
    </button>
  )
}
