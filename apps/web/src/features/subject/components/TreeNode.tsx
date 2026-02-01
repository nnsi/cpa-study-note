import { useState, useRef } from "react"
import type { CategoryNodeInput, SubcategoryNodeInput, TopicNodeInput } from "../api"

type TreeNodeProps = {
  category: CategoryNodeInput
  categoryIdx: number
  onUpdateCategory: (name: string) => void
  onDeleteCategory: () => void
  onAddSubcategory: () => void
  onUpdateSubcategory: (subIdx: number, name: string) => void
  onDeleteSubcategory: (subIdx: number) => void
  onAddTopic: (subIdx: number) => void
  onUpdateTopic: (subIdx: number, topicIdx: number, updates: Partial<TopicNodeInput>) => void
  onDeleteTopic: (subIdx: number, topicIdx: number) => void
  onSelectTopic: (subIdx: number, topicIdx: number) => void
  selectedTopicId: string | null
  onMoveCategory: (toIdx: number) => void
  onMoveSubcategory: (fromSubIdx: number, toSubIdx: number) => void
  onMoveTopic: (subIdx: number, fromTopicIdx: number, toTopicIdx: number) => void
  totalCategories: number
}

export function TreeNode({
  category,
  categoryIdx,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
  onAddTopic,
  onUpdateTopic,
  onDeleteTopic,
  onSelectTopic,
  selectedTopicId,
  onMoveCategory,
  onMoveSubcategory,
  onMoveTopic,
  totalCategories,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [editingCategoryName, setEditingCategoryName] = useState(false)
  const [categoryNameValue, setCategoryNameValue] = useState(category.name)
  const categoryInputRef = useRef<HTMLInputElement>(null)

  const handleCategoryNameSubmit = () => {
    if (categoryNameValue.trim()) {
      onUpdateCategory(categoryNameValue.trim())
    } else {
      setCategoryNameValue(category.name)
    }
    setEditingCategoryName(false)
  }

  const startEditingCategory = () => {
    setCategoryNameValue(category.name)
    setEditingCategoryName(true)
    setTimeout(() => categoryInputRef.current?.focus(), 0)
  }

  return (
    <div className="card overflow-hidden">
      {/* Category Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-transparent px-4 py-3 border-b border-ink-100">
        <div className="flex items-center gap-2">
          {/* Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-indigo-100 rounded transition-colors"
            aria-label={isExpanded ? "折りたたむ" : "展開する"}
          >
            <svg
              className={`size-4 text-ink-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Move buttons */}
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onMoveCategory(categoryIdx - 1)}
              disabled={categoryIdx === 0}
              className="p-0.5 hover:bg-indigo-100 rounded disabled:opacity-30 transition-colors"
              aria-label="上に移動"
            >
              <svg className="size-3 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onMoveCategory(categoryIdx + 1)}
              disabled={categoryIdx === totalCategories - 1}
              className="p-0.5 hover:bg-indigo-100 rounded disabled:opacity-30 transition-colors"
              aria-label="下に移動"
            >
              <svg className="size-3 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Category name */}
          <span className="text-lg">📂</span>
          {editingCategoryName ? (
            <input
              ref={categoryInputRef}
              type="text"
              value={categoryNameValue}
              onChange={(e) => setCategoryNameValue(e.target.value)}
              onBlur={handleCategoryNameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCategoryNameSubmit()
                if (e.key === "Escape") {
                  setCategoryNameValue(category.name)
                  setEditingCategoryName(false)
                }
              }}
              className="flex-1 px-2 py-0.5 rounded border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-ink-900 font-semibold"
            />
          ) : (
            <button
              type="button"
              onClick={startEditingCategory}
              className="flex-1 text-left font-semibold text-ink-900 hover:text-indigo-600 transition-colors"
            >
              {category.name}
            </button>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={onAddSubcategory}
              className="p-1.5 hover:bg-indigo-100 rounded transition-colors text-ink-500 hover:text-indigo-600"
              title="中単元を追加"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onDeleteCategory}
              className="p-1.5 hover:bg-crimson-100 rounded transition-colors text-ink-500 hover:text-crimson-600"
              title="削除"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Subcategories */}
      {isExpanded && (
        <div className="divide-y divide-ink-100">
          {category.subcategories.length === 0 ? (
            <div className="p-4 text-center text-ink-400 text-sm">
              中単元がありません
            </div>
          ) : (
            category.subcategories.map((subcategory, subIdx) => (
              <SubcategoryNode
                key={subcategory.id ?? `new-${subIdx}`}
                subcategory={subcategory}
                subIdx={subIdx}
                onUpdateSubcategory={(name) => onUpdateSubcategory(subIdx, name)}
                onDeleteSubcategory={() => onDeleteSubcategory(subIdx)}
                onAddTopic={() => onAddTopic(subIdx)}
                onUpdateTopic={(topicIdx, updates) => onUpdateTopic(subIdx, topicIdx, updates)}
                onDeleteTopic={(topicIdx) => onDeleteTopic(subIdx, topicIdx)}
                onSelectTopic={(topicIdx) => onSelectTopic(subIdx, topicIdx)}
                isTopicSelected={(topicIdx) => selectedTopicId === `${subIdx}-${topicIdx}`}
                onMoveSubcategory={(toIdx) => onMoveSubcategory(subIdx, toIdx)}
                onMoveTopic={(fromTopicIdx, toTopicIdx) => onMoveTopic(subIdx, fromTopicIdx, toTopicIdx)}
                totalSubcategories={category.subcategories.length}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

type SubcategoryNodeProps = {
  subcategory: SubcategoryNodeInput
  subIdx: number
  onUpdateSubcategory: (name: string) => void
  onDeleteSubcategory: () => void
  onAddTopic: () => void
  onUpdateTopic: (topicIdx: number, updates: Partial<TopicNodeInput>) => void
  onDeleteTopic: (topicIdx: number) => void
  onSelectTopic: (topicIdx: number) => void
  isTopicSelected: (topicIdx: number) => boolean
  onMoveSubcategory: (toIdx: number) => void
  onMoveTopic: (fromTopicIdx: number, toTopicIdx: number) => void
  totalSubcategories: number
}

function SubcategoryNode({
  subcategory,
  subIdx,
  onUpdateSubcategory,
  onDeleteSubcategory,
  onAddTopic,
  onUpdateTopic,
  onDeleteTopic,
  onSelectTopic,
  isTopicSelected,
  onMoveSubcategory,
  onMoveTopic,
  totalSubcategories,
}: SubcategoryNodeProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(subcategory.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleNameSubmit = () => {
    if (nameValue.trim()) {
      onUpdateSubcategory(nameValue.trim())
    } else {
      setNameValue(subcategory.name)
    }
    setEditingName(false)
  }

  const startEditing = () => {
    setNameValue(subcategory.name)
    setEditingName(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="p-3">
      {/* Subcategory Header */}
      <div className="flex items-center gap-2 mb-2">
        {/* Move buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onMoveSubcategory(subIdx - 1)}
            disabled={subIdx === 0}
            className="p-0.5 hover:bg-ink-100 rounded disabled:opacity-30 transition-colors"
            aria-label="上に移動"
          >
            <svg className="size-3 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMoveSubcategory(subIdx + 1)}
            disabled={subIdx === totalSubcategories - 1}
            className="p-0.5 hover:bg-ink-100 rounded disabled:opacity-30 transition-colors"
            aria-label="下に移動"
          >
            <svg className="size-3 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>

        <span>📁</span>
        {editingName ? (
          <input
            ref={inputRef}
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit()
              if (e.key === "Escape") {
                setNameValue(subcategory.name)
                setEditingName(false)
              }
            }}
            className="flex-1 px-2 py-0.5 rounded border border-ink-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-ink-700"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="flex-1 text-left font-medium text-ink-600 hover:text-indigo-600 transition-colors"
          >
            {subcategory.name}
          </button>
        )}

        <span className="text-sm text-ink-400">({subcategory.topics.length})</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddTopic}
            className="p-1 hover:bg-ink-100 rounded transition-colors text-ink-400 hover:text-indigo-600"
            title="論点を追加"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDeleteSubcategory}
            className="p-1 hover:bg-crimson-100 rounded transition-colors text-ink-400 hover:text-crimson-600"
            title="削除"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Topics */}
      <div className="ml-7 space-y-1">
        {subcategory.topics.map((topic, topicIdx) => (
          <TopicNode
            key={topic.id ?? `new-${topicIdx}`}
            topic={topic}
            topicIdx={topicIdx}
            onUpdate={(updates) => onUpdateTopic(topicIdx, updates)}
            onDelete={() => onDeleteTopic(topicIdx)}
            onSelect={() => onSelectTopic(topicIdx)}
            isSelected={isTopicSelected(topicIdx)}
            onMove={(toIdx) => onMoveTopic(topicIdx, toIdx)}
            totalTopics={subcategory.topics.length}
          />
        ))}
      </div>
    </div>
  )
}

type TopicNodeProps = {
  topic: TopicNodeInput
  topicIdx: number
  onUpdate: (updates: Partial<TopicNodeInput>) => void
  onDelete: () => void
  onSelect: () => void
  isSelected: boolean
  onMove: (toIdx: number) => void
  totalTopics: number
}

function TopicNode({
  topic,
  topicIdx,
  onUpdate,
  onDelete,
  onSelect,
  isSelected,
  onMove,
  totalTopics,
}: TopicNodeProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(topic.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleNameSubmit = () => {
    if (nameValue.trim()) {
      onUpdate({ name: nameValue.trim() })
    } else {
      setNameValue(topic.name)
    }
    setEditingName(false)
  }

  const startEditing = () => {
    setNameValue(topic.name)
    setEditingName(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors ${
        isSelected
          ? "bg-indigo-100 ring-1 ring-indigo-300"
          : "hover:bg-ink-50"
      }`}
    >
      {/* Move buttons */}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onMove(topicIdx - 1)}
          disabled={topicIdx === 0}
          className="p-0.5 hover:bg-ink-200 rounded disabled:opacity-30 transition-colors"
          aria-label="上に移動"
        >
          <svg className="size-2.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onMove(topicIdx + 1)}
          disabled={topicIdx === totalTopics - 1}
          className="p-0.5 hover:bg-ink-200 rounded disabled:opacity-30 transition-colors"
          aria-label="下に移動"
        >
          <svg className="size-2.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      <span className="text-ink-300">📄</span>

      {editingName ? (
        <input
          ref={inputRef}
          type="text"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleNameSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleNameSubmit()
            if (e.key === "Escape") {
              setNameValue(topic.name)
              setEditingName(false)
            }
          }}
          className="flex-1 px-2 py-0.5 rounded border border-ink-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-ink-700"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="flex-1 text-left text-sm text-ink-700 hover:text-indigo-600 transition-colors"
        >
          {topic.name}
        </button>
      )}

      {topic.difficulty && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full ${
            topic.difficulty === "basic"
              ? "bg-jade-100 text-jade-700"
              : topic.difficulty === "intermediate"
              ? "bg-amber-100 text-amber-700"
              : "bg-crimson-100 text-crimson-700"
          }`}
        >
          {topic.difficulty === "basic"
            ? "基礎"
            : topic.difficulty === "intermediate"
            ? "標準"
            : "応用"}
        </span>
      )}

      <button
        type="button"
        onClick={onSelect}
        className={`p-1 rounded transition-colors ${
          isSelected
            ? "bg-indigo-200 text-indigo-700"
            : "hover:bg-ink-100 text-ink-400 hover:text-indigo-600"
        }`}
        title="詳細編集"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="p-1 hover:bg-crimson-100 rounded transition-colors text-ink-400 hover:text-crimson-600"
        title="削除"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    </div>
  )
}
