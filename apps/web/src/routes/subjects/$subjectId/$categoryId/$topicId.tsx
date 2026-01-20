import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
}

function TopicDetailPage() {
  const { subjectId, categoryId, topicId } = Route.useParams()
  const [activeTab, setActiveTab] = useState<"info" | "chat" | "notes">("chat")
  const [sidebarTab, setSidebarTab] = useState<"info" | "notes" | "sessions">(
    "info"
  )
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
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

  // 新しいセッションを作成
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.chat.sessions.$post({
        json: { topicId },
      })
      if (!res.ok) throw new Error("Failed to create session")
      return res.json()
    },
    onSuccess: (data) => {
      setSelectedSessionId(data.session.id)
      queryClient.invalidateQueries({ queryKey: ["chat", "sessions", topicId] })
    },
  })

  // 選択中のセッションID（なければ最新のセッション、それもなければnull）
  const currentSessionId = selectedSessionId ?? sessions[0]?.id ?? null

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row">
      {/* モバイル: タブ切り替え */}
      <div className="lg:hidden border-b bg-white">
        <div className="flex">
          {(["info", "chat", "notes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500"
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
        <aside className="w-80 border-r bg-white flex flex-col">
          <div className="p-4 border-b">
            <Link
              to="/subjects/$subjectId/$categoryId"
              params={{ subjectId, categoryId }}
              className="text-blue-600 hover:underline text-sm"
            >
              ← 論点一覧
            </Link>
          </div>
          {/* サイドバータブ */}
          <div className="flex border-b">
            {(["info", "sessions", "notes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  sidebarTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
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
              <TopicInfo topic={topic.topic} subjectId={subjectId} />
            )}
            {sidebarTab === "sessions" && (
              <SessionList
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelect={setSelectedSessionId}
                onCreateNew={() => createSessionMutation.mutate()}
                isCreating={createSessionMutation.isPending}
              />
            )}
            {sidebarTab === "notes" && <TopicNotes topicId={topicId} />}
          </div>
        </aside>

        {/* 右: チャット */}
        <main className="flex-1 flex flex-col">
          {currentSessionId ? (
            <ChatContainer
              key={currentSessionId}
              sessionId={currentSessionId}
              topicId={topicId}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 mb-4">
                  チャットセッションがありません
                </p>
                <button
                  onClick={() => createSessionMutation.mutate()}
                  disabled={createSessionMutation.isPending}
                  className="btn-primary"
                >
                  {createSessionMutation.isPending
                    ? "作成中..."
                    : "新しいチャットを開始"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* モバイル: タブコンテンツ */}
      <div className="lg:hidden flex-1 overflow-hidden">
        {activeTab === "info" && topic && (
          <div className="h-full overflow-y-auto">
            <TopicInfo topic={topic.topic} subjectId={subjectId} />
          </div>
        )}
        {activeTab === "chat" && (
          <div className="h-full flex flex-col">
            {/* セッション選択バー */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b">
              <select
                value={currentSessionId ?? ""}
                onChange={(e) => setSelectedSessionId(e.target.value || null)}
                className="flex-1 text-sm border rounded px-2 py-1"
              >
                {sessions.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.createdAt).toLocaleDateString("ja-JP")} (
                    {s.messageCount}件)
                  </option>
                ))}
              </select>
              <button
                onClick={() => createSessionMutation.mutate()}
                disabled={createSessionMutation.isPending}
                className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
              >
                + 新規
              </button>
            </div>
            {currentSessionId ? (
              <ChatContainer
                key={currentSessionId}
                sessionId={currentSessionId}
                topicId={topicId}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={() => createSessionMutation.mutate()}
                  disabled={createSessionMutation.isPending}
                  className="btn-primary"
                >
                  新しいチャットを開始
                </button>
              </div>
            )}
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
  isCreating,
}: {
  sessions: Session[]
  currentSessionId: string | null
  onSelect: (id: string) => void
  onCreateNew: () => void
  isCreating: boolean
}) {
  return (
    <div className="p-4">
      <button
        onClick={onCreateNew}
        disabled={isCreating}
        className="w-full mb-4 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
      >
        {isCreating ? "作成中..." : "+ 新しいチャットを開始"}
      </button>

      {sessions.length === 0 ? (
        <p className="text-gray-500 text-center text-sm">
          まだチャット履歴がありません
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                session.id === currentSessionId
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">
                  {new Date(session.createdAt).toLocaleDateString("ja-JP", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs text-gray-500">
                  {session.messageCount}件
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
