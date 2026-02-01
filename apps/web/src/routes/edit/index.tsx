import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getColorClass } from "@/lib/colorClasses"
import {
  getStudyDomains,
  createStudyDomain,
  updateStudyDomain,
  deleteStudyDomain,
  type StudyDomain,
  type CreateStudyDomainInput,
  type UpdateStudyDomainInput,
} from "@/features/study-domain/api"
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  type Subject,
  type CreateSubjectInput,
  type UpdateSubjectInput,
} from "@/features/subject/api"

export const Route = createFileRoute("/edit/")({
  beforeLoad: requireAuth,
  component: EditPage,
})

function EditPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null)
  const [isCreateDomainOpen, setIsCreateDomainOpen] = useState(false)
  const [domainToEdit, setDomainToEdit] = useState<StudyDomain | null>(null)
  const [domainToDelete, setDomainToDelete] = useState<StudyDomain | null>(null)
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false)
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null)
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null)

  // Fetch domains
  const { data: domainsData, isLoading: domainsLoading } = useQuery({
    queryKey: ["study-domains"],
    queryFn: getStudyDomains,
  })

  // Fetch subjects for selected domain
  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects", { studyDomainId: selectedDomainId }],
    queryFn: () => getSubjects(selectedDomainId!),
    enabled: !!selectedDomainId,
  })

  // Domain mutations
  const createDomainMutation = useMutation({
    mutationFn: createStudyDomain,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["study-domains"] })
      setIsCreateDomainOpen(false)
      setSelectedDomainId(data.studyDomain.id)
    },
  })

  const updateDomainMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStudyDomainInput }) =>
      updateStudyDomain(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-domains"] })
      setDomainToEdit(null)
    },
  })

  const deleteDomainMutation = useMutation({
    mutationFn: (id: string) => deleteStudyDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-domains"] })
      setDomainToDelete(null)
      if (selectedDomainId === domainToDelete?.id) {
        setSelectedDomainId(null)
      }
    },
  })

  // Subject mutations
  const createSubjectMutation = useMutation({
    mutationFn: (data: CreateSubjectInput) => createSubject(selectedDomainId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["subjects", { studyDomainId: selectedDomainId }] })
      setIsCreateSubjectOpen(false)
      navigate({
        to: "/domains/$domainId/subjects/$subjectId/edit",
        params: { domainId: selectedDomainId!, subjectId: result.subject.id },
      })
    },
  })

  const updateSubjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubjectInput }) =>
      updateSubject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", { studyDomainId: selectedDomainId }] })
      setSubjectToEdit(null)
    },
  })

  const deleteSubjectMutation = useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", { studyDomainId: selectedDomainId }] })
      setSubjectToDelete(null)
    },
  })

  const domains = domainsData?.studyDomains ?? []
  const subjects = subjectsData?.subjects ?? []
  const selectedDomain = domains.find((d) => d.id === selectedDomainId)

  if (domainsLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <div className="h-10 w-48 skeleton rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 skeleton rounded-2xl" />
            ))}
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="ornament-line pb-4">
          <h1 className="heading-serif text-2xl lg:text-3xl">科目の構造を編集</h1>
          <p className="text-ink-500 mt-1">学習領域と科目を管理します</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Domain list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink-800">学習領域</h2>
              <button
                type="button"
                onClick={() => setIsCreateDomainOpen(true)}
                className="btn-secondary text-sm"
              >
                <svg className="size-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                新規作成
              </button>
            </div>

            {domains.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="size-12 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="size-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-ink-500 text-sm">学習領域がありません</p>
                <button
                  type="button"
                  onClick={() => setIsCreateDomainOpen(true)}
                  className="btn-primary text-sm mt-4"
                >
                  学習領域を作成
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {domains.map((domain) => (
                  <div
                    key={domain.id}
                    className={`card p-4 cursor-pointer transition-all ${
                      selectedDomainId === domain.id
                        ? "ring-2 ring-indigo-500 bg-indigo-50/50"
                        : "hover:shadow-md"
                    }`}
                    onClick={() => setSelectedDomainId(domain.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-lg ${getColorClass(domain.color)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xl">{domain.emoji ?? "📚"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-ink-800">{domain.name}</h3>
                        {domain.description && (
                          <p className="text-sm text-ink-500 truncate">{domain.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDomainToEdit(domain)
                          }}
                          className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-ink-700"
                          title="編集"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDomainToDelete(domain)
                          }}
                          className="p-1.5 rounded-lg hover:bg-crimson-50 text-ink-500 hover:text-crimson-600"
                          title="削除"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subject list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink-800">
                {selectedDomain ? `${selectedDomain.name} の科目` : "科目"}
              </h2>
              {selectedDomainId && (
                <button
                  type="button"
                  onClick={() => setIsCreateSubjectOpen(true)}
                  className="btn-secondary text-sm"
                >
                  <svg className="size-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  新規作成
                </button>
              )}
            </div>

            {!selectedDomainId ? (
              <div className="card p-8 text-center">
                <div className="size-12 rounded-xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="size-6 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18" />
                  </svg>
                </div>
                <p className="text-ink-500 text-sm">学習領域を選択してください</p>
              </div>
            ) : subjectsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 skeleton rounded-xl" />
                ))}
              </div>
            ) : subjects.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="size-12 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="size-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-ink-500 text-sm">科目がありません</p>
                <button
                  type="button"
                  onClick={() => setIsCreateSubjectOpen(true)}
                  className="btn-primary text-sm mt-4"
                >
                  科目を作成
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {subjects.map((subject) => (
                  <div
                    key={subject.id}
                    className="card p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-lg ${getColorClass(subject.color)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xl">{subject.emoji ?? "📘"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-ink-800">{subject.name}</h3>
                        {subject.description && (
                          <p className="text-sm text-ink-500 truncate">{subject.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Link
                          to="/domains/$domainId/subjects/$subjectId/edit"
                          params={{ domainId: selectedDomainId, subjectId: subject.id }}
                          className="btn-primary text-sm px-3 py-1.5"
                        >
                          単元を編集
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSubjectToEdit(subject)}
                          className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-ink-700"
                          title="科目情報を編集"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubjectToDelete(subject)}
                          className="p-1.5 rounded-lg hover:bg-crimson-50 text-ink-500 hover:text-crimson-600"
                          title="削除"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Domain Modals */}
      {isCreateDomainOpen && (
        <DomainModal
          title="学習領域を作成"
          onClose={() => setIsCreateDomainOpen(false)}
          onSubmit={(data) => createDomainMutation.mutate(data)}
          isLoading={createDomainMutation.isPending}
          error={createDomainMutation.error?.message}
        />
      )}

      {domainToEdit && (
        <DomainModal
          title="学習領域を編集"
          domain={domainToEdit}
          onClose={() => setDomainToEdit(null)}
          onSubmit={(data) => updateDomainMutation.mutate({ id: domainToEdit.id, data })}
          isLoading={updateDomainMutation.isPending}
          error={updateDomainMutation.error?.message}
        />
      )}

      {domainToDelete && (
        <DeleteConfirmModal
          title="学習領域を削除"
          name={domainToDelete.name}
          onClose={() => setDomainToDelete(null)}
          onConfirm={() => deleteDomainMutation.mutate(domainToDelete.id)}
          isLoading={deleteDomainMutation.isPending}
          error={deleteDomainMutation.error?.message}
        />
      )}

      {/* Subject Modals */}
      {isCreateSubjectOpen && (
        <SubjectModal
          title="科目を作成"
          onClose={() => setIsCreateSubjectOpen(false)}
          onSubmit={(data) => createSubjectMutation.mutate(data)}
          isLoading={createSubjectMutation.isPending}
          error={createSubjectMutation.error?.message}
        />
      )}

      {subjectToEdit && (
        <SubjectModal
          title="科目を編集"
          subject={subjectToEdit}
          onClose={() => setSubjectToEdit(null)}
          onSubmit={(data) => updateSubjectMutation.mutate({ id: subjectToEdit.id, data })}
          isLoading={updateSubjectMutation.isPending}
          error={updateSubjectMutation.error?.message}
        />
      )}

      {subjectToDelete && (
        <DeleteConfirmModal
          title="科目を削除"
          name={subjectToDelete.name}
          onClose={() => setSubjectToDelete(null)}
          onConfirm={() => deleteSubjectMutation.mutate(subjectToDelete.id)}
          isLoading={deleteSubjectMutation.isPending}
          error={deleteSubjectMutation.error?.message}
        />
      )}
    </PageWrapper>
  )
}

// Domain Modal
function DomainModal({
  title,
  domain,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  title: string
  domain?: StudyDomain
  onClose: () => void
  onSubmit: (data: CreateStudyDomainInput) => void
  isLoading: boolean
  error?: string
}) {
  const [name, setName] = useState(domain?.name ?? "")
  const [description, setDescription] = useState(domain?.description ?? "")
  const [emoji, setEmoji] = useState(domain?.emoji ?? "")
  const [color, setColor] = useState<string | null>(domain?.color ?? null)

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
        <h2 className="heading-serif text-xl mb-6">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="domain-name" className="block text-sm font-medium text-ink-700 mb-1">
              名前 <span className="text-crimson-500">*</span>
            </label>
            <input
              type="text"
              id="domain-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 公認会計士試験"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="domain-description" className="block text-sm font-medium text-ink-700 mb-1">
              説明
            </label>
            <textarea
              id="domain-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="学習領域の説明（任意）"
              className="input w-full h-20 resize-none"
            />
          </div>

          <div>
            <label htmlFor="domain-emoji" className="block text-sm font-medium text-ink-700 mb-1">
              アイコン（絵文字）
            </label>
            <input
              type="text"
              id="domain-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📚"
              className="input w-20"
              maxLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">カラー</label>
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
              {isLoading ? "保存中..." : domain ? "保存" : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Subject Modal
function SubjectModal({
  title,
  subject,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  title: string
  subject?: Subject
  onClose: () => void
  onSubmit: (data: CreateSubjectInput) => void
  isLoading: boolean
  error?: string
}) {
  const [name, setName] = useState(subject?.name ?? "")
  const [description, setDescription] = useState(subject?.description ?? "")
  const [emoji, setEmoji] = useState(subject?.emoji ?? "")
  const [color, setColor] = useState<string | null>(subject?.color ?? null)

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
        <h2 className="heading-serif text-xl mb-6">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="subject-name" className="block text-sm font-medium text-ink-700 mb-1">
              名前 <span className="text-crimson-500">*</span>
            </label>
            <input
              type="text"
              id="subject-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 財務会計論"
              className="input w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="subject-description" className="block text-sm font-medium text-ink-700 mb-1">
              説明
            </label>
            <textarea
              id="subject-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="科目の説明（任意）"
              className="input w-full h-20 resize-none"
            />
          </div>

          <div>
            <label htmlFor="subject-emoji" className="block text-sm font-medium text-ink-700 mb-1">
              アイコン（絵文字）
            </label>
            <input
              type="text"
              id="subject-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📘"
              className="input w-20"
              maxLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">カラー</label>
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
              {isLoading ? "保存中..." : subject ? "保存" : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Delete Confirm Modal
function DeleteConfirmModal({
  title,
  name,
  onClose,
  onConfirm,
  isLoading,
  error,
}: {
  title: string
  name: string
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
          <h2 className="heading-serif text-lg mb-2">{title}</h2>
          <p className="text-sm text-ink-500">
            「{name}」を削除しますか？<br />
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
