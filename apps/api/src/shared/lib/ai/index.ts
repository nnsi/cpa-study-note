import { createVercelAIAdapter } from "./adapters/vercel-ai"
import { createMockAdapter } from "./adapters/mock"
import type { AIAdapter } from "./types"
import type { AIProvider } from "../env"

type AIAdapterConfig = {
  provider: AIProvider
  apiKey?: string
}

export const createAIAdapter = (config: AIAdapterConfig): AIAdapter => {
  switch (config.provider) {
    case "vercel-ai":
      if (!config.apiKey) throw new Error("API key required for vercel-ai")
      return createVercelAIAdapter(config.apiKey)
    case "mock":
      return createMockAdapter()
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}

export { streamToSSE } from "./sse"
export type {
  AIAdapter,
  AIMessage,
  StreamChunk,
  GenerateTextInput,
  StreamTextInput,
} from "./types"
