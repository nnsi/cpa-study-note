import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getNotes } from "@/features/note/api"

export const Route = createFileRoute("/notes/")({
  beforeLoad: requireAuth,
  component: NotesPage,
})

function NotesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["notes"],
    queryFn: getNotes,
  })

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <div className="h-10 w-32 skeleton rounded-lg" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
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

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
      <div className="ornament-line pb-4">
        <h1 className="heading-serif text-2xl lg:text-3xl">ノート</h1>
      </div>

      {data?.notes.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center mx-auto mb-6">
            <svg className="size-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <h3 className="heading-serif text-lg text-ink-700 mb-2">
            まだノートがありません
          </h3>
          <p className="text-sm text-ink-500">
            チャットで学習した後、ノートを作成できます
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.notes.map((note, index) => (
            <Link
              key={note.id}
              to="/notes/$noteId"
              params={{ noteId: note.id }}
              className="card-hover block p-5 group animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="space-y-3">
                {/* 科目・論点 */}
                <div className="flex items-center gap-2">
                  <span className="badge-primary">
                    {note.subjectName}
                  </span>
                  <span className="text-sm text-ink-600 font-medium">
                    {note.topicName}
                  </span>
                </div>

                {/* サマリー */}
                <p className="text-ink-700 line-clamp-2 leading-relaxed">
                  {note.aiSummary}
                </p>

                {/* メタ情報 */}
                <div className="flex items-center gap-4 text-sm text-ink-500">
                  <span className="flex items-center gap-1">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    {new Date(note.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                  {note.keyPoints.length > 0 && (
                    <span className="flex items-center gap-1">
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                      {note.keyPoints.length} ポイント
                    </span>
                  )}
                </div>
              </div>

              {/* 矢印 */}
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-ink-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all duration-300">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </PageWrapper>
  )
}
