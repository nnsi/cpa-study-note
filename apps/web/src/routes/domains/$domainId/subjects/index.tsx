import { useState, useRef, useEffect } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { requireAuth } from "@/lib/auth"
import { PageWrapper } from "@/components/layout"
import { getColorClass } from "@/lib/colorClasses"
import { getStudyDomain } from "@/features/study-domain/api"
import {
  getSubjects,
  getSubjectTree,
  searchTopics,
  type TopicSearchResult,
  type CategoryNode,
} from "@/features/subject/api"
import { filterTopics, type FilteredTopic } from "@/features/review/api"
import { api } from "@/lib/api-client"
import { useDebounce } from "@/lib/hooks/useDebounce"
import { BulkCSVImporter } from "@/features/subject/components/BulkCSVImporter"

export const Route = createFileRoute("/domains/$domainId/subjects/")({
  beforeLoad: requireAuth,
  component: SubjectsPage,
})

function SubjectsPage() {
  const { domainId } = Route.useParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set())
  const [showImporter, setShowImporter] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

  // Search topics
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["topic-search", debouncedQuery, domainId],
    queryFn: () => searchTopics(debouncedQuery, domainId, 15),
    enabled: debouncedQuery.length >= 2,
  })

  // Fetch tree for expanded subject
  const { data: treeData, isLoading: isTreeLoading } = useQuery({
    queryKey: ["subject-tree", expandedSubjectId],
    queryFn: () => getSubjectTree(expandedSubjectId!),
    enabled: !!expandedSubjectId,
  })

  // Fetch user progress
  const { data: progressData } = useQuery({
    queryKey: ["progress", "me"],
    queryFn: async () => {
      const res = await api.api.subjects.progress.me.$get()
      if (!res.ok) throw new Error("進捗の取得に失敗しました")
      return res.json()
    },
  })

  // Fetch topic stats
  const { data: topicStatsData } = useQuery({
    queryKey: ["topics", "stats"],
    queryFn: () => filterTopics({}),
  })

  // Create maps
  type Progress = { topicId: string; understood: boolean }
  const progressMap = new Map<string, Progress>(
    progressData?.progress.map((p: Progress) => [p.topicId, p]) ?? []
  )
  const statsMap = new Map<string, FilteredTopic>(
    topicStatsData?.map((t) => [t.id, t]) ?? []
  )

  const subjects = data?.subjects ?? []

  const handleSubjectClick = (subjectId: string) => {
    if (expandedSubjectId === subjectId) {
      setExpandedSubjectId(null)
      setExpandedCategoryIds(new Set())
    } else {
      setExpandedSubjectId(subjectId)
      setExpandedCategoryIds(new Set())
    }
  }

  const handleCategoryClick = (categoryId: string) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const getSubcategoryStats = (subcategory: CategoryNode["subcategories"][0]) => {
    const topicCount = subcategory.topics.length
    const understoodCount = subcategory.topics.filter(
      (t) => progressMap.get(t.id)?.understood
    ).length
    return { topicCount, understoodCount }
  }

  // Group search results by subject
  const groupedResults = (searchResults ?? []).reduce<
    Record<string, { subjectName: string; topics: TopicSearchResult[] }>
  >((acc, result) => {
    if (!acc[result.subjectId]) {
      acc[result.subjectId] = { subjectName: result.subjectName, topics: [] }
    }
    acc[result.subjectId].topics.push(result)
    return acc
  }, {})

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <div className="h-10 w-40 skeleton rounded-lg" />
          <div className="h-12 skeleton rounded-xl" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 skeleton rounded-2xl" />
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

  return (
    <PageWrapper>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="ornament-line pb-4">
          <div className="flex items-center gap-2 text-sm text-ink-500 mb-1">
            <Link to="/domains" className="hover:text-indigo-600 transition-colors">
              学習領域
            </Link>
            <span>/</span>
            <span>{domainData?.studyDomain.name ?? "..."}</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="heading-serif text-2xl lg:text-3xl">科目一覧</h1>
            <button
              onClick={() => setShowImporter(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-medium"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              CSVインポート
            </button>
          </div>
        </div>

        {/* Search Box */}
        <div ref={searchRef} className="relative">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-ink-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="論点を検索..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-ink-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none text-ink-800 placeholder:text-ink-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchFocused && debouncedQuery.length >= 2 && (
            <div className="absolute z-50 w-full mt-2 bg-white rounded-xl border border-ink-200 shadow-lg max-h-[60vh] overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-ink-500">
                  <div className="size-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  検索中...
                </div>
              ) : Object.keys(groupedResults).length === 0 ? (
                <div className="p-4 text-center text-ink-500">
                  該当する論点が見つかりません
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {Object.entries(groupedResults).map(([subjectId, group]) => (
                    <div key={subjectId}>
                      <div className="px-4 py-2 bg-ink-50 text-sm font-medium text-ink-600">
                        {group.subjectName}
                      </div>
                      {group.topics.map((topic) => (
                        <Link
                          key={topic.id}
                          to="/domains/$domainId/subjects/$subjectId/$categoryId/$topicId"
                          params={{
                            domainId,
                            subjectId: topic.subjectId,
                            categoryId: topic.categoryId,
                            topicId: topic.id,
                          }}
                          className="block px-4 py-3 hover:bg-indigo-50 transition-colors"
                          onClick={() => {
                            setSearchQuery("")
                            setIsSearchFocused(false)
                          }}
                        >
                          <div className="font-medium text-ink-800">{topic.name}</div>
                          <div className="text-sm text-ink-500 mt-0.5">
                            {topic.categoryName}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subject List */}
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
              ホームの「科目の構造を編集」から科目を作成してください
            </p>
            <Link to="/" className="btn-primary">
              ホームに戻る
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {subjects.map((subject, index) => {
              const isExpanded = expandedSubjectId === subject.id
              const categories = isExpanded ? (treeData?.tree.categories ?? []) : []

              return (
                <div
                  key={subject.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* Subject Card */}
                  <button
                    onClick={() => handleSubjectClick(subject.id)}
                    className={`w-full text-left card-hover p-4 transition-all ${
                      isExpanded ? "rounded-t-2xl rounded-b-none border-b-0" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`size-12 rounded-xl ${getColorClass(subject.color)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-2xl">{subject.emoji ?? "📚"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-ink-900 text-lg">
                          {subject.name}
                        </h2>
                        {subject.description && (
                          <p className="text-sm text-ink-500 mt-0.5 line-clamp-1">
                            {subject.description}
                          </p>
                        )}
                      </div>
                      <div className={`text-ink-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="card rounded-t-none rounded-b-2xl border-t-0 p-4 bg-ink-50/50">
                      {isTreeLoading ? (
                        <div className="py-8 text-center">
                          <div className="size-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <span className="text-sm text-ink-500">読み込み中...</span>
                        </div>
                      ) : categories.length === 0 ? (
                        <div className="py-6 text-center text-ink-500 text-sm">
                          単元がありません
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {categories.map((category) => {
                            const isCategoryExpanded = expandedCategoryIds.has(category.id)

                            return (
                              <div key={category.id}>
                                {/* Category (大単元) Header */}
                                <button
                                  onClick={() => handleCategoryClick(category.id)}
                                  className="w-full flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/80 transition-colors text-left"
                                >
                                  <div className="size-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                                    </svg>
                                  </div>
                                  <span className="font-medium text-ink-800 flex-1">{category.name}</span>
                                  <span className="text-sm text-ink-500">
                                    {category.subcategories.length}単元
                                  </span>
                                  <div className={`text-ink-400 transition-transform ${isCategoryExpanded ? "rotate-180" : ""}`}>
                                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                    </svg>
                                  </div>
                                </button>

                                {/* Subcategories (中単元) & Topics */}
                                {isCategoryExpanded && (
                                  <div className="ml-10 mt-2 space-y-2">
                                    {category.subcategories.map((subcategory) => {
                                      const stats = getSubcategoryStats(subcategory)
                                      const isAllUnderstood = stats.topicCount > 0 && stats.understoodCount === stats.topicCount

                                      return (
                                        <div key={subcategory.id} className="bg-white rounded-xl p-3 border border-ink-100">
                                          {/* Subcategory Header */}
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className={`size-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                                              isAllUnderstood ? "bg-jade-100 text-jade-600" : "bg-ink-100 text-ink-500"
                                            }`}>
                                              {isAllUnderstood ? (
                                                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                </svg>
                                              ) : (
                                                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                                                </svg>
                                              )}
                                            </div>
                                            <span className={`font-medium text-sm ${isAllUnderstood ? "text-jade-700" : "text-ink-700"}`}>
                                              {subcategory.name}
                                            </span>
                                            <span className="text-xs text-ink-400 ml-auto">
                                              {stats.understoodCount}/{stats.topicCount}
                                            </span>
                                          </div>

                                          {/* Topics */}
                                          <div className="space-y-1">
                                            {subcategory.topics.map((topic) => {
                                              const isUnderstood = progressMap.get(topic.id)?.understood
                                              const sessionCount = statsMap.get(topic.id)?.sessionCount ?? 0

                                              return (
                                                <Link
                                                  key={topic.id}
                                                  to="/domains/$domainId/subjects/$subjectId/$categoryId/$topicId"
                                                  params={{
                                                    domainId,
                                                    subjectId: subject.id,
                                                    categoryId: subcategory.id,
                                                    topicId: topic.id,
                                                  }}
                                                  className="flex items-center gap-2 py-1.5 px-2 -mx-1 rounded-lg hover:bg-indigo-50 transition-colors group"
                                                >
                                                  <div className={`size-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                    isUnderstood
                                                      ? "border-jade-500 bg-jade-500"
                                                      : "border-ink-300"
                                                  }`}>
                                                    {isUnderstood && (
                                                      <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                      </svg>
                                                    )}
                                                  </div>
                                                  <span className="text-sm text-ink-700 group-hover:text-indigo-700 transition-colors flex-1 truncate">
                                                    {topic.name}
                                                  </span>
                                                  {sessionCount > 0 && (
                                                    <span className="text-xs text-ink-400 flex items-center gap-0.5">
                                                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                                                      </svg>
                                                      {sessionCount}
                                                    </span>
                                                  )}
                                                  <svg className="size-4 text-ink-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                                  </svg>
                                                </Link>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CSV Importer Modal */}
      {showImporter && (
        <BulkCSVImporter domainId={domainId} onClose={() => setShowImporter(false)} />
      )}
    </PageWrapper>
  )
}
