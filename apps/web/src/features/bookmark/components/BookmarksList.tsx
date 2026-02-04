import { Link } from "@tanstack/react-router"
import { useBookmarks } from "../hooks"
import type { BookmarkWithDetails } from "../api"

type GroupedBookmarks = {
  subjects: BookmarkWithDetails[]
  categories: BookmarkWithDetails[]
  topics: BookmarkWithDetails[]
}

const groupBookmarks = (bookmarks: BookmarkWithDetails[]): GroupedBookmarks => {
  return bookmarks.reduce(
    (acc, bookmark) => {
      switch (bookmark.targetType) {
        case "subject":
          acc.subjects.push(bookmark)
          break
        case "category":
          acc.categories.push(bookmark)
          break
        case "topic":
          acc.topics.push(bookmark)
          break
      }
      return acc
    },
    { subjects: [], categories: [], topics: [] } as GroupedBookmarks
  )
}

const getNavigationUrl = (bookmark: BookmarkWithDetails): string => {
  const { domainId, targetType, targetId, subjectId, categoryId } = bookmark

  switch (targetType) {
    case "subject":
      // /domains/:domainId/subjects/:subjectId
      return `/domains/${domainId}/subjects/${targetId}`
    case "category":
      // /domains/:domainId/subjects/:subjectId (カテゴリ一覧ページ)
      // subjectIdが必須
      if (!subjectId) return `/domains/${domainId}/subjects`
      return `/domains/${domainId}/subjects/${subjectId}`
    case "topic":
      // /domains/:domainId/subjects/:subjectId/:categoryId/:topicId
      // subjectIdとcategoryIdが必須
      if (!subjectId || !categoryId) return `/domains/${domainId}/subjects`
      return `/domains/${domainId}/subjects/${subjectId}/${categoryId}/${targetId}`
    default:
      return `/domains/${domainId}/subjects`
  }
}

const BookmarkGroup = ({
  title,
  icon,
  bookmarks,
}: {
  title: string
  icon: React.ReactNode
  bookmarks: BookmarkWithDetails[]
}) => {
  if (bookmarks.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-ink-500 uppercase tracking-wider flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {bookmarks.map((bookmark) => (
          <Link
            key={bookmark.id}
            to={getNavigationUrl(bookmark)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ink-50 hover:bg-indigo-50
                       rounded-full text-sm text-ink-700 hover:text-indigo-700 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 text-amber-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
            <span className="truncate max-w-[150px]">{bookmark.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export const BookmarksList = () => {
  const { bookmarks, isLoading, error } = useBookmarks()

  if (isLoading) {
    return (
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 skeleton rounded" />
          <div className="h-5 w-24 skeleton rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 w-24 skeleton rounded-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 text-crimson-600 text-sm">
        ブックマークの読み込みに失敗しました
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
          </div>
          <h3 className="font-medium text-ink-800">ブックマーク</h3>
        </div>
        <p className="text-sm text-ink-500">
          科目・単元・論点をブックマークしてすぐアクセスできます
        </p>
      </div>
    )
  }

  const grouped = groupBookmarks(bookmarks)

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
        </div>
        <h3 className="font-medium text-ink-800">ブックマーク</h3>
        <span className="text-xs text-ink-400">({bookmarks.length})</span>
      </div>

      <div className="space-y-4">
        <BookmarkGroup
          title="論点"
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
          }
          bookmarks={grouped.topics}
        />
        <BookmarkGroup
          title="単元"
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
            </svg>
          }
          bookmarks={grouped.categories}
        />
        <BookmarkGroup
          title="科目"
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          }
          bookmarks={grouped.subjects}
        />
      </div>
    </div>
  )
}
