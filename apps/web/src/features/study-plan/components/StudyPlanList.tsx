import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useStudyPlans, useCreateStudyPlan, useArchiveStudyPlan, useUnarchiveStudyPlan, useDuplicateStudyPlan } from "../hooks"
import type { StudyPlanWithItemCount } from "../api"
import type { StudyPlanScope } from "@cpa-study/shared/schemas"

const scopeLabels: Record<string, string> = {
  all: "全体",
  subject: "科目",
  topic_group: "論点群",
}

const PlanCard = ({ plan, onArchive, onUnarchive, onDuplicate }: {
  plan: StudyPlanWithItemCount
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onDuplicate: (id: string) => void
}) => {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/plans/$planId"
          params={{ planId: plan.id }}
          className="flex-1 min-w-0"
        >
          <h3 className="font-semibold text-ink-900 hover:text-indigo-700 transition-colors truncate">
            {plan.title}
          </h3>
        </Link>
        <span className="shrink-0 px-2 py-0.5 text-xs rounded-full bg-ink-100 text-ink-600">
          {scopeLabels[plan.scope] ?? plan.scope}
        </span>
      </div>

      {plan.intent && (
        <p className="text-sm text-ink-600 line-clamp-2">{plan.intent}</p>
      )}

      <div className="flex items-center justify-between text-xs text-ink-400">
        <span>{plan.itemCount}件の要素</span>
        <span>{new Date(plan.createdAt).toLocaleDateString("ja-JP")}</span>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-ink-100">
        {plan.archivedAt ? (
          <button
            type="button"
            onClick={() => onUnarchive(plan.id)}
            className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            復元
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onArchive(plan.id)}
            className="text-xs text-ink-500 hover:text-ink-700 transition-colors"
          >
            アーカイブ
          </button>
        )}
        <button
          type="button"
          onClick={() => onDuplicate(plan.id)}
          className="text-xs text-ink-500 hover:text-ink-700 transition-colors"
        >
          複製
        </button>
      </div>
    </div>
  )
}

export const StudyPlanList = () => {
  const [tab, setTab] = useState<"active" | "archived">("active")
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [intent, setIntent] = useState("")
  const [scope, setScope] = useState<StudyPlanScope>("all")

  const { plans, isLoading, error } = useStudyPlans({ archived: tab === "archived" })
  const createMutation = useCreateStudyPlan()
  const archiveMutation = useArchiveStudyPlan()
  const unarchiveMutation = useUnarchiveStudyPlan()
  const duplicateMutation = useDuplicateStudyPlan()

  const handleCreate = () => {
    if (!title.trim()) return
    createMutation.mutate(
      { title: title.trim(), intent: intent.trim() || undefined, scope },
      {
        onSuccess: () => {
          setTitle("")
          setIntent("")
          setScope("all")
          setShowForm(false)
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="heading-serif text-2xl">学習計画</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm px-4 py-2"
        >
          {showForm ? "閉じる" : "新しい計画"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">計画の名称</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 財務会計論 短答式対策"
              className="w-full px-3 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">意図・背景（任意）</label>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="この計画を立てた理由や背景"
              className="w-full px-3 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              rows={3}
              maxLength={2000}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">対象範囲</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as StudyPlanScope)}
              className="px-3 py-2 border border-ink-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">全体</option>
              <option value="subject">科目</option>
              <option value="topic_group">論点群</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!title.trim() || createMutation.isPending}
              className="btn-primary text-sm px-6 py-2 disabled:opacity-50"
            >
              {createMutation.isPending ? "作成中..." : "作成"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-200">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "active"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          アクティブ
        </button>
        <button
          type="button"
          onClick={() => setTab("archived")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "archived"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-ink-500 hover:text-ink-700"
          }`}
        >
          アーカイブ
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="h-5 w-48 skeleton rounded" />
              <div className="h-4 w-full skeleton rounded" />
              <div className="h-3 w-24 skeleton rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card p-6 text-crimson-600 text-sm">
          計画の読み込みに失敗しました
        </div>
      )}

      {/* Plans */}
      {!isLoading && !error && plans.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-ink-500">
            {tab === "active"
              ? "まだ計画がありません。「新しい計画」から作成できます。"
              : "アーカイブされた計画はありません。"}
          </p>
        </div>
      )}

      {!isLoading && !error && plans.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onArchive={(id) => archiveMutation.mutate(id)}
              onUnarchive={(id) => unarchiveMutation.mutate(id)}
              onDuplicate={(id) => duplicateMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
