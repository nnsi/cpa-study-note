import { useState, useCallback } from "react"
import { Link } from "@tanstack/react-router"
import {
  useStudyPlanDetail,
  useUpdateStudyPlan,
  useAddStudyPlanItem,
  useUpdateStudyPlanItem,
  useRemoveStudyPlanItem,
  useAddStudyPlanRevision,
  useArchiveStudyPlan,
} from "../hooks"
import type { StudyPlanItemResponse, StudyPlanRevisionResponse } from "../api"

const scopeLabels: Record<string, string> = {
  all: "全体",
  subject: "科目",
  topic_group: "論点群",
}

// Item display
const ItemCard = ({ item, planId, onRemove }: {
  item: StudyPlanItemResponse
  planId: string
  onRemove: (itemId: string) => void
}) => {
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(item.description)
  const [rationale, setRationale] = useState(item.rationale ?? "")
  const updateMutation = useUpdateStudyPlanItem(planId)

  const handleSave = () => {
    updateMutation.mutate(
      { itemId: item.id, input: { description, rationale: rationale || null } },
      { onSuccess: () => setEditing(false) }
    )
  }

  if (editing) {
    return (
      <div className="card p-4 space-y-3 border-l-4 border-indigo-300">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
          rows={2}
        />
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="そう考えた理由（任意）"
          className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
          rows={2}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-500 hover:text-ink-700">キャンセル</button>
          <button type="button" onClick={handleSave} disabled={updateMutation.isPending} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            {updateMutation.isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-2 group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ink-800 flex-1">{item.description}</p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-ink-400 hover:text-indigo-600 p-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button type="button" onClick={() => onRemove(item.id)} className="text-xs text-ink-400 hover:text-crimson-600 p-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {item.rationale && (
        <p className="text-xs text-ink-500 italic">理由: {item.rationale}</p>
      )}
      {item.topicName && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded-full">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          {item.topicName}
        </span>
      )}
    </div>
  )
}

// Revision display
const RevisionCard = ({ revision }: { revision: StudyPlanRevisionResponse }) => (
  <div className="flex gap-3 py-3">
    <div className="w-2 h-2 mt-1.5 rounded-full bg-ink-300 shrink-0" />
    <div className="space-y-1">
      <p className="text-sm text-ink-800">{revision.summary}</p>
      <p className="text-xs text-ink-500">理由: {revision.reason}</p>
      <p className="text-xs text-ink-400">{new Date(revision.createdAt).toLocaleDateString("ja-JP")}</p>
    </div>
  </div>
)

export const StudyPlanDetail = ({ planId }: { planId: string }) => {
  const { data, isLoading, error } = useStudyPlanDetail(planId)
  const [showItemForm, setShowItemForm] = useState(false)
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [itemDescription, setItemDescription] = useState("")
  const [itemRationale, setItemRationale] = useState("")
  const [revisionSummary, setRevisionSummary] = useState("")
  const [revisionReason, setRevisionReason] = useState("")

  const addItemMutation = useAddStudyPlanItem(planId)
  const removeItemMutation = useRemoveStudyPlanItem(planId)
  const addRevisionMutation = useAddStudyPlanRevision(planId)
  const archiveMutation = useArchiveStudyPlan()

  const handleAddItem = useCallback(() => {
    if (!itemDescription.trim()) return
    const orderIndex = data?.items.length ?? 0
    addItemMutation.mutate(
      { description: itemDescription.trim(), rationale: itemRationale.trim() || undefined, orderIndex },
      {
        onSuccess: () => {
          setItemDescription("")
          setItemRationale("")
          setShowItemForm(false)
        },
      }
    )
  }, [itemDescription, itemRationale, data?.items.length, addItemMutation])

  const handleAddRevision = useCallback(() => {
    if (!revisionSummary.trim() || !revisionReason.trim()) return
    addRevisionMutation.mutate(
      { summary: revisionSummary.trim(), reason: revisionReason.trim() },
      {
        onSuccess: () => {
          setRevisionSummary("")
          setRevisionReason("")
          setShowRevisionForm(false)
        },
      }
    )
  }, [revisionSummary, revisionReason, addRevisionMutation])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded" />
        <div className="h-4 w-full skeleton rounded" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 h-20 skeleton rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card p-6 text-crimson-600 text-sm">
        計画の読み込みに失敗しました
      </div>
    )
  }

  const { plan, items, revisions } = data

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link to="/plans" className="text-sm text-ink-500 hover:text-indigo-600 transition-colors mb-2 inline-block">
          &larr; 計画一覧に戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="heading-serif text-2xl mb-1">{plan.title}</h1>
            <div className="flex items-center gap-3 text-sm text-ink-500">
              <span className="px-2 py-0.5 bg-ink-100 rounded-full text-xs">{scopeLabels[plan.scope] ?? plan.scope}</span>
              <span>{new Date(plan.createdAt).toLocaleDateString("ja-JP")} 作成</span>
              {plan.archivedAt && (
                <span className="text-amber-600">アーカイブ済み</span>
              )}
            </div>
          </div>
          {!plan.archivedAt && (
            <button
              type="button"
              onClick={() => archiveMutation.mutate(planId)}
              className="text-sm text-ink-500 hover:text-ink-700 transition-colors"
            >
              アーカイブ
            </button>
          )}
        </div>
        {plan.intent && (
          <p className="mt-3 text-ink-600 text-sm bg-ink-50 rounded-lg p-4">
            {plan.intent}
          </p>
        )}
      </div>

      {/* Items */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-serif text-lg">計画要素</h2>
          <button
            type="button"
            onClick={() => setShowItemForm(!showItemForm)}
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {showItemForm ? "閉じる" : "+ 要素を追加"}
          </button>
        </div>

        {showItemForm && (
          <div className="card p-4 mb-4 space-y-3">
            <textarea
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="やろうと考えた内容"
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
              rows={2}
              maxLength={2000}
            />
            <textarea
              value={itemRationale}
              onChange={(e) => setItemRationale(e.target.value)}
              placeholder="そう考えた理由（任意）"
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
              rows={2}
              maxLength={2000}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!itemDescription.trim() || addItemMutation.isPending}
                className="btn-primary text-xs px-4 py-1.5 disabled:opacity-50"
              >
                {addItemMutation.isPending ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-ink-400 py-4">まだ要素がありません</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                planId={planId}
                onRemove={(itemId) => removeItemMutation.mutate(itemId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Revisions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="heading-serif text-lg">変遷の記録</h2>
          <button
            type="button"
            onClick={() => setShowRevisionForm(!showRevisionForm)}
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {showRevisionForm ? "閉じる" : "+ 変遷を記録"}
          </button>
        </div>

        {showRevisionForm && (
          <div className="card p-4 mb-4 space-y-3">
            <textarea
              value={revisionSummary}
              onChange={(e) => setRevisionSummary(e.target.value)}
              placeholder="何をどう変えたか"
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
              rows={2}
              maxLength={2000}
            />
            <textarea
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="なぜ変えたか"
              className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
              rows={2}
              maxLength={2000}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddRevision}
                disabled={!revisionSummary.trim() || !revisionReason.trim() || addRevisionMutation.isPending}
                className="btn-primary text-xs px-4 py-1.5 disabled:opacity-50"
              >
                {addRevisionMutation.isPending ? "記録中..." : "記録"}
              </button>
            </div>
          </div>
        )}

        {revisions.length === 0 ? (
          <p className="text-sm text-ink-400 py-4">まだ変遷の記録はありません</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {revisions.map((revision) => (
              <RevisionCard key={revision.id} revision={revision} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
