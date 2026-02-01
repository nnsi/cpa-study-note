import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getColorClass } from "@/lib/colorClasses"
import { getStudyDomain } from "@/features/study-domain/api"
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  type Subject,
  type CreateSubjectInput,
  type UpdateSubjectInput,
} from "@/features/subject/api"

export const Route = createFileRoute("/domains/$domainId/subjects/")({
  beforeLoad: requireAuth,
  component: SubjectsPage,
})

function SubjectsPage() {
  const { domainId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null)
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null)

  // Fetch domain info
  const { data: domainData } = useQuery({
    queryKey: ["study-domain", domainId],
    queryFn: () => getStudyDomain(domainId),
  })

  // Fetch subjects
  const { data, isLoading, error } = useQuery({
    queryKey: ["subjects", { studyDomainId: domainId }],
    queryFn: () => getSubjects(domainId),
  })

  // Create subject mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateSubjectInput) => createSubject(domainId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["subjects", { studyDomainId: domainId }] })
      setIsCreateModalOpen(false)
      navigate({
        to: "/domains/$domainId/subjects/$subjectId",
        params: { domainId, subjectId: result.subject.id },
      })
    },
  })

  // Update subject mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubjectInput }) =>
      updateSubject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", { studyDomainId: domainId }] })
      setSubjectToEdit(null)
    },
  })

  // Delete subject mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", { studyDomainId: domainId }] })
      setSubjectToDelete(null)
    },
  })

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <div className="h-10 w-40 skeleton rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 skeleton rounded-2xl" />
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

  const subjects = data?.subjects ?? []

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
        {/* Header with breadcrumb */}
        <div className="flex items-center justify-between ornament-line pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-ink-500 mb-1">
              <Link to="/domains" className="hover:text-indigo-600 transition-colors">
                学習領域
              </Link>
              <span>/</span>
              <span>{domainData?.studyDomain.name ?? "..."}</span>
            </div>
            <h1 className="heading-serif text-2xl lg:text-3xl">科目一覧</h1>
          </div>
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

        {subjects.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center mx-auto mb-6">
              <svg className="size-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="heading-serif text-lg text-ink-700 mb-2">
              科目がありません
            </h3>
            <p className="text-sm text-ink-500 mb-6">
              最初の科目を作成して、学習を始めましょう
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary"
            >
              科目を作成
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {subjects.map((subject, index) => (
              <div
                key={subject.id}
                className="card-hover p-5 animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative flex items-start gap-4">
                  {/* アイコン */}
                  <div className={`size-12 rounded-xl ${getColorClass(subject.color)} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-2xl">{subject.emoji ?? "📚"}</span>
                  </div>

                  {/* コンテンツ */}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-ink-900 text-lg">
                      {subject.name}
                    </h2>
                    {subject.description && (
                      <p className="text-sm text-ink-500 mt-1 line-clamp-2">
                        {subject.description}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3">
                      <Link
                        to="/domains/$domainId/subjects/$subjectId"
                        params={{ domainId, subjectId: subject.id }}
                        className="btn-primary text-sm px-4 py-1.5"
                      >
                        開く
                      </Link>
                      <button
                        type="button"
                        onClick={() => setSubjectToEdit(subject)}
                        className="btn-secondary text-sm px-3 py-1.5"
                        title="編集"
                      >
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubjectToDelete(subject)}
                        className="btn-secondary text-sm px-3 py-1.5 text-crimson-600 hover:bg-crimson-50"
                        title="削除"
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
        <CreateSubjectModal
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          error={createMutation.error?.message}
        />
      )}

      {/* Edit Modal */}
      {subjectToEdit && (
        <EditSubjectModal
          subject={subjectToEdit}
          onClose={() => setSubjectToEdit(null)}
          onSubmit={(data) => updateMutation.mutate({ id: subjectToEdit.id, data })}
          isLoading={updateMutation.isPending}
          error={updateMutation.error?.message}
        />
      )}

      {/* Delete Confirmation Modal */}
      {subjectToDelete && (
        <DeleteConfirmModal
          subject={subjectToDelete}
          onClose={() => setSubjectToDelete(null)}
          onConfirm={() => deleteMutation.mutate(subjectToDelete.id)}
          isLoading={deleteMutation.isPending}
          error={deleteMutation.error?.message}
        />
      )}
    </PageWrapper>
  )
}

function CreateSubjectModal({
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  onClose: () => void
  onSubmit: (data: CreateSubjectInput) => void
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
        <h2 className="heading-serif text-xl mb-6">科目を作成</h2>

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
              placeholder="例: 財務会計論"
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
              placeholder="科目の説明（任意）"
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
              placeholder="📘"
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

function EditSubjectModal({
  subject,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  subject: Subject
  onClose: () => void
  onSubmit: (data: UpdateSubjectInput) => void
  isLoading: boolean
  error?: string
}) {
  const [name, setName] = useState(subject.name)
  const [description, setDescription] = useState(subject.description ?? "")
  const [emoji, setEmoji] = useState(subject.emoji ?? "")
  const [color, setColor] = useState<string | null>(subject.color)

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
        <h2 className="heading-serif text-xl mb-6">科目を編集</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-ink-700 mb-1">
              名前 <span className="text-crimson-500">*</span>
            </label>
            <input
              type="text"
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 財務会計論"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-ink-700 mb-1">
              説明
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="科目の説明（任意）"
              className="input w-full h-20 resize-none"
            />
          </div>

          <div>
            <label htmlFor="edit-emoji" className="block text-sm font-medium text-ink-700 mb-1">
              アイコン（絵文字）
            </label>
            <input
              type="text"
              id="edit-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📘"
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
              {isLoading ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  subject,
  onClose,
  onConfirm,
  isLoading,
  error,
}: {
  subject: Subject
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
          <h2 className="heading-serif text-lg mb-2">科目を削除</h2>
          <p className="text-sm text-ink-500">
            「{subject.name}」を削除しますか？<br />
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
