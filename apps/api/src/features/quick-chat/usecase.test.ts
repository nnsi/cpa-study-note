import { describe, expect, it, vi } from "vitest"
import { defaultAIConfig } from "@/shared/lib/ai"
import { noopLogger } from "../../test/helpers"
import type { QuickChatRepository } from "./repository"
import { suggestTopicsForChat } from "./usecase"

const createRepo = (domainExists: boolean): QuickChatRepository => ({
  domainExists: vi.fn().mockResolvedValue(domainExists),
  findAllTopicsByDomain: vi.fn().mockResolvedValue([]),
})

describe("suggestTopicsForChat", () => {
  it("存在しない・別ユーザーの学習領域ではAIを呼び出さない", async () => {
    const quickChatRepo = createRepo(false)
    const aiAdapter = {
      generateText: vi.fn(),
      streamText: vi.fn(),
    }

    const result = await suggestTopicsForChat(
      { quickChatRepo, aiAdapter, aiConfig: defaultAIConfig, logger: noopLogger },
      { domainId: "other-users-domain", userId: "user-1", question: "質問" }
    )

    expect(result.ok).toBe(false)
    expect(aiAdapter.generateText).not.toHaveBeenCalled()
    expect(quickChatRepo.findAllTopicsByDomain).not.toHaveBeenCalled()
  })

  it("所有する空の学習領域では新規論点提案のためAIを呼び出す", async () => {
    const quickChatRepo = createRepo(true)
    const aiAdapter = {
      generateText: vi.fn().mockResolvedValue({ content: '{"suggestions":[]}' }),
      streamText: vi.fn(),
    }

    const result = await suggestTopicsForChat(
      { quickChatRepo, aiAdapter, aiConfig: defaultAIConfig, logger: noopLogger },
      { domainId: "domain-1", userId: "user-1", question: "質問" }
    )

    expect(result.ok).toBe(true)
    expect(aiAdapter.generateText).toHaveBeenCalledOnce()
  })
})
