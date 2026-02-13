import { describe, it, expect } from "vitest"
import { suggestTopics, type TopicGeneratorDeps } from "./usecase"
import { createMockAIAdapter } from "@/test/mocks/ai"
import { noopLogger, noopTracer } from "../../test/helpers"
import { resolveAIConfig } from "@/shared/lib/ai/config"
import type { StreamChunk } from "@/shared/lib/ai"

// ストリームを配列に収集するヘルパー
const collectStream = async (stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> => {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return chunks
}

// テスト用の依存関係を作成するファクトリ
const createTestDeps = (overrides: Partial<TopicGeneratorDeps> = {}): TopicGeneratorDeps => {
  const mockSubjectRepo = {
    findById: async (subjectId: string, userId: string) => {
      if (subjectId === "not-found" || userId === "wrong-user") return null
      return {
        id: subjectId,
        userId,
        studyDomainId: "domain-1",
        name: "財務会計論",
        description: null,
        emoji: null,
        color: null,
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }
    },
    findCategoriesBySubjectId: async (_subjectId: string, _userId: string) => [
      { id: "cat-1", name: "有価証券", depth: 0, parentId: null, displayOrder: 0 },
    ],
  } as unknown as TopicGeneratorDeps["subjectRepo"]

  const mockStudyDomainRepo = {
    findById: async (_id: string, _userId: string) => ({
      id: "domain-1",
      userId: "test-user",
      name: "公認会計士試験",
      description: null,
      emoji: null,
      color: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }),
  } as unknown as TopicGeneratorDeps["studyDomainRepo"]

  return {
    subjectRepo: mockSubjectRepo,
    studyDomainRepo: mockStudyDomainRepo,
    aiAdapter: createMockAIAdapter({
      streamChunks: ["提案します。\n\n", '```json\n{"categories":[]}\n```'],
    }),
    aiConfig: resolveAIConfig("local"),
    logger: noopLogger,
    tracer: noopTracer,
    ...overrides,
  }
}

describe("suggestTopics", () => {
  it("科目が見つからない場合はエラーチャンクを返す", async () => {
    const deps = createTestDeps()
    const chunks = await collectStream(
      suggestTopics(deps, {
        subjectId: "not-found",
        userId: "test-user",
        prompt: "棚卸資産について",
      })
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual({
      type: "error",
      error: "科目が見つかりません",
    })
  })

  it("正常時はtextチャンクとdoneチャンクを返す", async () => {
    const deps = createTestDeps()
    const chunks = await collectStream(
      suggestTopics(deps, {
        subjectId: "subject-1",
        userId: "test-user",
        prompt: "棚卸資産について",
      })
    )

    // textチャンクが含まれる
    const textChunks = chunks.filter((c) => c.type === "text")
    expect(textChunks.length).toBeGreaterThan(0)

    // 最後はdoneチャンク
    const lastChunk = chunks[chunks.length - 1]
    expect(lastChunk).toEqual({ type: "done" })
  })

  it("AIアダプタがエラーを投げた場合はエラーチャンクを返す", async () => {
    const deps = createTestDeps({
      aiAdapter: createMockAIAdapter({
        shouldError: true,
        errorMessage: "AI service unavailable",
      }),
    })

    const chunks = await collectStream(
      suggestTopics(deps, {
        subjectId: "subject-1",
        userId: "test-user",
        prompt: "棚卸資産について",
      })
    )

    const errorChunk = chunks.find((c) => c.type === "error")
    expect(errorChunk).toBeDefined()
    expect(errorChunk?.error).toContain("AI応答中にエラーが発生しました")
  })

  it("テキストチャンクの内容がAIレスポンスと一致する", async () => {
    const streamChunks = ["カテゴリ1: ", "棚卸資産の定義"]
    const deps = createTestDeps({
      aiAdapter: createMockAIAdapter({ streamChunks }),
    })

    const chunks = await collectStream(
      suggestTopics(deps, {
        subjectId: "subject-1",
        userId: "test-user",
        prompt: "棚卸資産について",
      })
    )

    const textContents = chunks
      .filter((c) => c.type === "text")
      .map((c) => c.content)
    expect(textContents).toEqual(streamChunks)
  })

  it("空のtextチャンクはyieldしない", async () => {
    const deps = createTestDeps({
      aiAdapter: createMockAIAdapter({
        streamChunks: ["有効なテキスト"],
      }),
    })

    const chunks = await collectStream(
      suggestTopics(deps, {
        subjectId: "subject-1",
        userId: "test-user",
        prompt: "テスト",
      })
    )

    // textチャンクは全て空でない
    const textChunks = chunks.filter((c) => c.type === "text")
    for (const chunk of textChunks) {
      expect(chunk.content).toBeTruthy()
    }
  })
})
