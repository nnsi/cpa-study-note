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

function TopicDetailPage() {
  const { subjectId, categoryId, topicId } = Route.useParams()
  const [activeTab, setActiveTab] = useState<"info" | "chat" | "notes">("chat")
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

  // セッション取得または作成
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["chat", "session", topicId],
    queryFn: async () => {
      // 新しいセッションを作成
      const res = await api.api.chat.sessions.$post({
        json: { topicId },
      })
      if (!res.ok) throw new Error("Failed to create session")
      return res.json()
    },
    staleTime: Infinity,
  })

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
        {/* 左: 論点情報 */}
        <aside className="w-80 border-r bg-white overflow-y-auto">
          <div className="p-4">
            <Link
              to="/subjects/$subjectId/$categoryId"
              params={{ subjectId, categoryId }}
              className="text-blue-600 hover:underline text-sm"
            >
              ← 論点一覧
            </Link>
          </div>
          {topic && <TopicInfo topic={topic.topic} subjectId={subjectId} />}
        </aside>

        {/* 右: チャット */}
        <main className="flex-1 flex flex-col">
          {session && !sessionLoading ? (
            <ChatContainer sessionId={session.session.id} topicId={topicId} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
        {activeTab === "chat" && session && (
          <ChatContainer sessionId={session.session.id} topicId={topicId} />
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
