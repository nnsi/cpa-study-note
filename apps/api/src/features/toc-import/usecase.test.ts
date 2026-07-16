import { describe, expect, it, vi } from "vitest"
import type { AIAdapter, StreamChunk, StreamTextInput } from "@/shared/lib/ai"
import { resolveAIConfig } from "@/shared/lib/ai/config"
import { noopLogger, noopTracer } from "@/test/helpers"
import { createMockAIAdapter } from "@/test/mocks/ai"
import { createMockR2Bucket } from "@/test/mocks/r2"
import { suggestFromToc, type TocImportDeps } from "./usecase"

const collectStream = async (stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> => {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return chunks
}

const createSubject = (id: string, userId: string) => ({
  id,
  userId,
  studyDomainId: "domain-1",
  name: "財務\n会計論",
  description: null,
  emoji: null,
  color: null,
  displayOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
})

const createImage = (id: string, userId: string) => ({
  id,
  userId,
  filename: `${id}.png`,
  mimeType: "image/png",
  size: 4,
  r2Key: `images/${id}.png`,
  ocrText: null,
  createdAt: new Date(),
})

const createTestDeps = async (
  params: {
    imageIds?: string[]
    imageOwnerId?: string
    aiAdapter?: AIAdapter
  } = {}
): Promise<TocImportDeps> => {
  const imageIds = params.imageIds ?? ["image-1"]
  const imageOwnerId = params.imageOwnerId ?? "user-1"
  const images = new Map(imageIds.map((id) => [id, createImage(id, imageOwnerId)]))
  const r2 = createMockR2Bucket()

  for (const image of images.values()) {
    await r2.put(image.r2Key, new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)
  }

  return {
    subjectRepo: {
      findById: async (subjectId, userId) =>
        subjectId === "not-found" ? null : createSubject(subjectId, userId),
      findCategoriesBySubjectId: async () => [
        {
          id: "category-1",
          userId: "user-1",
          subjectId: "subject-1",
          name: "既存\nカテゴリ",
          depth: 0,
          parentId: null,
          displayOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    },
    imageRepo: {
      findById: async (imageId) => images.get(imageId) ?? null,
    },
    aiAdapter:
      params.aiAdapter ??
      createMockAIAdapter({
        streamChunks: ["抽出結果", '{"categories":[]}'],
      }),
    aiConfig: resolveAIConfig("local"),
    r2,
    logger: noopLogger,
    tracer: noopTracer,
  }
}

describe("suggestFromToc", () => {
  it("正常時はtextチャンク列の後にdoneチャンクを返す", async () => {
    const deps = await createTestDeps()

    const chunks = await collectStream(
      suggestFromToc(deps, {
        subjectId: "subject-1",
        userId: "user-1",
        imageIds: ["image-1"],
      })
    )

    expect(chunks).toEqual([
      { type: "text", content: "抽出結果" },
      { type: "text", content: '{"categories":[]}' },
      { type: "done" },
    ])
  })

  it("科目がない場合はerrorチャンクだけを返す", async () => {
    const deps = await createTestDeps()

    const chunks = await collectStream(
      suggestFromToc(deps, {
        subjectId: "not-found",
        userId: "user-1",
        imageIds: ["image-1"],
      })
    )

    expect(chunks).toEqual([{ type: "error", error: "科目が見つかりません" }])
  })

  it("他人の画像の場合は対象を示すerrorチャンクを返す", async () => {
    const deps = await createTestDeps({ imageOwnerId: "other-user" })

    const chunks = await collectStream(
      suggestFromToc(deps, {
        subjectId: "subject-1",
        userId: "user-1",
        imageIds: ["image-1"],
      })
    )

    expect(chunks).toEqual([{ type: "error", error: "画像 1/1へのアクセス権限がありません" }])
  })

  it("N件の画像IDをN個の画像付きメッセージとして指定順で渡す", async () => {
    const inputs: StreamTextInput[] = []
    const baseAdapter = createMockAIAdapter({ streamChunks: ["結果"] })
    const aiAdapter: AIAdapter = {
      ...baseAdapter,
      streamText: vi.fn((input: StreamTextInput) => {
        inputs.push(input)
        return baseAdapter.streamText(input)
      }),
    }
    const imageIds = ["image-1", "image-2", "image-3"]
    const deps = await createTestDeps({ imageIds, aiAdapter })

    await collectStream(
      suggestFromToc(deps, {
        subjectId: "subject-1",
        userId: "user-1",
        imageIds,
      })
    )

    expect(inputs).toHaveLength(1)
    const imageMessages = inputs[0].messages.filter((message) => message.imageUrl !== undefined)
    expect(imageMessages).toHaveLength(3)
    expect(imageMessages.map((message) => message.content)).toEqual([
      "目次画像 1/3",
      "目次画像 2/3",
      "目次画像 3/3",
    ])
    expect(
      imageMessages.every((message) => message.imageUrl?.startsWith("data:image/png;base64,"))
    ).toBe(true)
    expect(inputs[0]).toMatchObject({
      model: "google/gemini-2.5-flash",
      temperature: 0,
      maxTokens: 8000,
    })
  })

  it("科目名と既存カテゴリ名をサニタイズしてプロンプトに埋める", async () => {
    const inputs: StreamTextInput[] = []
    const baseAdapter = createMockAIAdapter({ streamChunks: ["結果"] })
    const deps = await createTestDeps({
      aiAdapter: {
        ...baseAdapter,
        streamText: (input) => {
          inputs.push(input)
          return baseAdapter.streamText(input)
        },
      },
    })

    await collectStream(
      suggestFromToc(deps, {
        subjectId: "subject-1",
        userId: "user-1",
        imageIds: ["image-1"],
      })
    )

    expect(inputs[0].messages[0].content).toContain("科目: 財務 会計論")
    expect(inputs[0].messages[0].content).toContain("既存カテゴリ: 既存 カテゴリ")
  })
})
