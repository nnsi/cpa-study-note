import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getColorClass } from "@/lib/colorClasses"
import {
  getStudyDomains,
  createStudyDomain,
  deleteStudyDomain,
  type StudyDomain,
  type CreateStudyDomainInput,
} from "@/features/study-domain/api"

export const Route = createFileRoute("/domains/")({
  beforeLoad: requireAuth,
  component: DomainsPage,
})

function DomainsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [domainToDelete, setDomainToDelete] = useState<StudyDomain | null>(null)

  // Fetch user's study domains
  const {
    data: domainsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["study-domains"],
    queryFn: getStudyDomains,
  })

  // Create study domain mutation
  const createMutation = useMutation({
    mutationFn: createStudyDomain,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["study-domains"] })
      setIsCreateModalOpen(false)
      navigate({ to: "/domains/$domainId/subjects", params: { domainId: data.studyDomain.id } })
    },
  })

  // Delete study domain mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStudyDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-domains"] })
      setDomainToDelete(null)
    },
  })

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <div className="h-10 w-48 skeleton rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-2xl" />
            ))}
          </div>
        </div>
      </PageWrapper>
    )
  }

  if (error) {
    return (
      <PageWrapper>
        <div className="card p-6 text-center">
          <div className="size-12 rounded-xl bg-crimson-400/10 flex items-center justify-center mx-auto mb-4">
            <svg className="size-6 text-crimson-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-crimson-500 font-medium">エラーが発生しました</p>
        </div>
      </PageWrapper>
    )
  }

  const domains = domainsData?.studyDomains ?? []

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between ornament-line pb-4">
          <h1 className="heading-serif text-2xl lg:text-3xl">学習領域</h1>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            新規作成
          </button>
        </div>

        {domains.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mx-auto mb-6">
              <svg className="size-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="heading-serif text-lg text-ink-700 mb-2">
              学習領域がありません
            </h3>
            <p className="text-sm text-ink-500 mb-6">
              最初の学習領域を作成して、学習を始めましょう
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary"
            >
              学習領域を作成
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {domains.map((domain, index) => (
              <div
                key={domain.id}
                className="card-hover p-5 animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative flex items-start gap-4">
                  {/* Icon */}
                  <div className={`size-14 rounded-xl ${getColorClass(domain.color)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-3xl">{domain.emoji ?? "📚"}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-ink-900 text-lg mb-1">
                      {domain.name}
                    </h2>
                    {domain.description && (
                      <p className="text-sm text-ink-500 line-clamp-2 mb-3">
                        {domain.description}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/domains/$domainId/subjects", params: { domainId: domain.id } })}
                        className="btn-primary text-sm px-4 py-1.5"
                      >
                        開く
                      </button>
                      <button
                        type="button"
                        onClick={() => setDomainToDelete(domain)}
                        className="btn-secondary text-sm px-3 py-1.5 text-crimson-600 hover:bg-crimson-50"
                      >
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <CreateDomainModal
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          error={createMutation.error?.message}
        />
      )}

      {/* Delete Confirmation Modal */}
      {domainToDelete && (
        <DeleteConfirmModal
          domain={domainToDelete}
          onClose={() => setDomainToDelete(null)}
          onConfirm={() => deleteMutation.mutate(domainToDelete.id)}
          isLoading={deleteMutation.isPending}
          error={deleteMutation.error?.message}
        />
      )}
    </PageWrapper>
  )
}

function CreateDomainModal({
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  onClose: () => void
  onSubmit: (data: CreateStudyDomainInput) => void
  isLoading: boolean
  error?: string
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("")
  const [color, setColor] = useState<string | null>(null)

  const colors = [
    { value: "indigo", label: "藍色" },
    { value: "jade", label: "翠色" },
    { value: "amber", label: "琥珀" },
    { value: "crimson", label: "紅色" },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      emoji: emoji.trim() || undefined,
      color: color ?? undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 animate-fade-in">
        <h2 className="heading-serif text-xl mb-6">学習領域を作成</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-ink-700 mb-1">
              名前 <span className="text-crimson-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 公認会計士試験"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-ink-700 mb-1">
              説明
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="学習領域の説明（任意）"
              className="input w-full h-20 resize-none"
            />
          </div>

          <div>
            <label htmlFor="emoji" className="block text-sm font-medium text-ink-700 mb-1">
              アイコン（絵文字）
            </label>
            <input
              type="text"
              id="emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📚"
              className="input w-20"
              maxLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              カラー
            </label>
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`size-10 rounded-xl ${getColorClass(c.value)} border-2 transition-all ${
                    color === c.value ? "border-ink-900 scale-110" : "border-transparent"
                  }`}
                  title={c.label}
                />
              ))}
              <button
                type="button"
                onClick={() => setColor(null)}
                className={`size-10 rounded-xl bg-ink-100 border-2 transition-all ${
                  color === null ? "border-ink-900 scale-110" : "border-transparent"
                }`}
                title="なし"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-crimson-50 rounded-lg">
              <p className="text-sm text-crimson-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? "作成中..." : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  domain,
  onClose,
  onConfirm,
  isLoading,
  error,
}: {
  domain: StudyDomain
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  error?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 animate-fade-in">
        <div className="text-center mb-6">
          <div className="size-12 rounded-xl bg-crimson-400/10 flex items-center justify-center mx-auto mb-4">
            <svg className="size-6 text-crimson-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </div>
          <h2 className="heading-serif text-lg mb-2">学習領域を削除</h2>
          <p className="text-sm text-ink-500">
            「{domain.name}」を削除しますか？<br />
            この操作は取り消せません。
          </p>
        </div>

        {error && (
          <div className="p-3 bg-crimson-50 rounded-lg mb-4">
            <p className="text-sm text-crimson-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={isLoading}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary flex-1 bg-crimson-500 hover:bg-crimson-600"
            disabled={isLoading}
          >
            {isLoading ? "削除中..." : "削除"}
          </button>
        </div>
      </div>
    </div>
  )
}
