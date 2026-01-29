import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { ChatContainer } from "@/features/chat"
import { TopicInfo } from "@/features/topic"
import { TopicNotes } from "@/features/note"
import { requireAuth } from "@/lib/auth"

export const Route = createFileRoute(
  "/subjects/$subjectId/$categoryId/$topicId"
)({
  beforeLoad: requireAuth,
  component: TopicDetailPage,
})

type Session = {
  id: string
  createdAt: string
  messageCount: number
  goodCount: number
  surfaceCount: number
  firstMessagePreview: string | null
}

function TopicDetailPage() {
  const { subjectId, categoryId, topicId } = Route.useParams()
  const [activeTab, setActiveTab] = useState<"info" | "chat" | "notes">("chat")
  const [sidebarTab, setSidebarTab] = useState<"info" | "notes" | "sessions">(
    "info"
  )
  // null = 新規セッションモード（最初のメッセージ送信でセッション作成）
  // "use-latest" = 最新のセッションを使用
  const [selectedSessionId, setSelectedSessionId] = useState<string | null | "use-latest">("use-latest")
  const queryClient = useQueryClient()

  const { data: topic, isLoading } = useQuery({
    queryKey: ["topics", topicId],
    queryFn: async () => {
      const res = await api.api.subjects[":subjectId"].topics[":topicId"].$get({
        param: { subjectId, topicId },
      })
      if (!res.ok) throw new Error("Failed to fetch topic")
      return res.json()
    },
  })

  // セッション一覧を取得
  const { data: sessionsData } = useQuery({
    queryKey: ["chat", "sessions", topicId],
    queryFn: async () => {
      const res = await api.api.chat.topics[":topicId"].sessions.$get({
        param: { topicId },
      })
      if (!res.ok) throw new Error("Failed to fetch sessions")
      return res.json()
    },
  })

  const sessions: Session[] = sessionsData?.sessions ?? []

  // 新しいチャットを開始（セッションIDをnullにして新規モードに）
  const startNewChat = useCallback(() => {
    setSelectedSessionId(null)
  }, [])

  // セッションが作成されたときのコールバック
  const handleSessionCreated = useCallback((newSessionId: string) => {
    setSelectedSessionId(newSessionId)
    queryClient.invalidateQueries({ queryKey: ["chat", "sessions", topicId] })
  }, [queryClient, topicId])

  // 選択中のセッションID
  // "use-latest" の場合は最新のセッションを使用、null は新規セッションモード
  const currentSessionId = selectedSessionId === "use-latest"
    ? (sessions[0]?.id ?? null)
    : selectedSessionId

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse">
          <div className="h-8 skeleton rounded w-1/3 mb-4" />
          <div className="h-64 skeleton rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-w-0 flex flex-col lg:flex-row overflow-hidden">
      {/* モバイル: ヘッダー + タブ切り替え */}
      <div className="lg:hidden border-b border-ink-100 bg-white">
        <div className="px-4 py-2 border-b border-ink-100">
          <Link
            to="/subjects/$subjectId/$categoryId"
            params={{ subjectId, categoryId }}
            className="text-indigo-600 hover:underline text-sm"
          >
            ← 論点一覧
          </Link>
          {topic && (
            <div className="mt-1">
              <p className="text-xs text-ink-500 truncate">
                {topic.topic.subjectName} / {topic.topic.categoryName}
              </p>
              <h1 className="text-base font-bold text-ink-900 truncate">
                {topic.topic.name}
              </h1>
            </div>
          )}
        </div>
        <div className="flex">
          {(["info", "chat", "notes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-ink-500"
              }`}
            >
              {tab === "info" && "情報"}
              {tab === "chat" && "チャット"}
              {tab === "notes" && "ノート"}
            </button>
          ))}
        </div>
      </div>

      {/* PC: 2カラムレイアウト */}
      <div className="hidden lg:flex flex-1">
        {/* 左: 論点情報 / ノート */}
        <aside className="w-80 border-r border-ink-100 bg-white flex flex-col">
          <div className="p-4 border-b border-ink-100">
            <Link
              to="/subjects/$subjectId/$categoryId"
              params={{ subjectId, categoryId }}
              className="text-indigo-600 hover:underline text-sm"
            >
              ← 論点一覧
            </Link>
            {topic && (
              <div className="mt-2">
                <p className="text-xs text-ink-500">
                  {topic.topic.subjectName} / {topic.topic.categoryName}
                </p>
                <h1 className="text-base font-bold text-ink-900 leading-tight">
                  {topic.topic.name}
                </h1>
              </div>
            )}
          </div>
          {/* サイドバータブ */}
          <div className="flex border-b border-ink-100">
            {(["info", "sessions", "notes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  sidebarTab === tab
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-ink-500 hover:text-ink-700"
                }`}
              >
                {tab === "info" && "情報"}
                {tab === "sessions" && "履歴"}
                {tab === "notes" && "ノート"}
              </button>
            ))}
          </div>
          {/* サイドバーコンテンツ */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === "info" && topic && (
              <TopicInfo topic={topic.topic} subjectId={subjectId} sessions={sessions} />
            )}
            {sidebarTab === "sessions" && (
              <SessionList
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelect={setSelectedSessionId}
                onCreateNew={startNewChat}
              />
            )}
            {sidebarTab === "notes" && <TopicNotes topicId={topicId} />}
          </div>
        </aside>

        {/* 右: チャット */}
        <main className="flex-1 flex flex-col">
          <ChatContainer
            key={currentSessionId ?? "new"}
            sessionId={currentSessionId}
            topicId={topicId}
            onSessionCreated={handleSessionCreated}
            onNavigateToNotes={() => setSidebarTab("notes")}
          />
        </main>
      </div>

      {/* モバイル: タブコンテンツ */}
      <div className="lg:hidden flex-1 min-h-0 overflow-hidden min-w-0 flex flex-col">
        {activeTab === "info" && topic && (
          <div className="h-full overflow-y-auto">
            <TopicInfo topic={topic.topic} subjectId={subjectId} sessions={sessions} />
          </div>
        )}
        {activeTab === "chat" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* セッション選択バー */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-ink-50 border-b border-ink-100">
              <select
                value={currentSessionId ?? "new"}
                onChange={(e) => setSelectedSessionId(e.target.value === "new" ? null : e.target.value)}
                className="flex-1 text-sm border border-ink-200 rounded-lg px-3 py-1.5 bg-white"
              >
                <option value="new">新しいチャット</option>
                {sessions.map((s) => {
                  const qualityLabel = s.goodCount > 0 ? ` | ✔${s.goodCount}` : ""
                  return (
                    <option key={s.id} value={s.id}>
                      {new Date(s.createdAt).toLocaleDateString("ja-JP")} ({s.messageCount}件{qualityLabel})
                    </option>
                  )
                })}
              </select>
              <button
                onClick={startNewChat}
                className="text-sm text-indigo-600 hover:text-indigo-700 whitespace-nowrap font-medium"
              >
                + 新規
              </button>
            </div>
            <ChatContainer
              key={currentSessionId ?? "new"}
              sessionId={currentSessionId}
              topicId={topicId}
              onSessionCreated={handleSessionCreated}
              onNavigateToNotes={() => setActiveTab("notes")}
            />
          </div>
        )}
        {activeTab === "notes" && (
          <div className="h-full overflow-y-auto">
            <TopicNotes topicId={topicId} />
          </div>
        )}
      </div>
    </div>
  )
}

// セッション一覧コンポーネント
function SessionList({
  sessions,
  currentSessionId,
  onSelect,
  onCreateNew,
}: {
  sessions: Session[]
  currentSessionId: string | null
  onSelect: (id: string | null) => void
  onCreateNew: () => void
}) {
  return (
    <div className="p-4">
      <button
        onClick={onCreateNew}
        className="w-full mb-4 py-2.5 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
      >
        + 新しいチャットを開始
      </button>

      {sessions.length === 0 ? (
        <p className="text-ink-500 text-center text-sm">
          まだチャット履歴がありません
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                session.id === currentSessionId
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-ink-200 hover:bg-ink-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-800">
                  {new Date(session.createdAt).toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs text-ink-500">
                  {session.messageCount}件
                </span>
              </div>
              {/* プレビュー */}
              {session.firstMessagePreview && (
                <p className="text-xs text-ink-500 mt-1.5 truncate">
                  {session.firstMessagePreview}
                  {session.firstMessagePreview.length >= 50 && "..."}
                </p>
              )}
              {/* 深掘り質問統計 */}
              {session.goodCount > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-0.5 text-2xs text-jade-600">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {session.goodCount}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
