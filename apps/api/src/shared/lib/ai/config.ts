import type { Environment } from "@/shared/lib/env"

/**
 * AI設定の型定義
 *
 * 環境（local/staging/production）や
 * ユーザープラン（無料/プレミアム）によって異なる設定を返せるように設計
 */
export type AIModelConfig = {
  model: string
  temperature: number
  maxTokens: number
}

export type AIConfig = {
  chat: AIModelConfig
  evaluation: AIModelConfig
  noteSummary: AIModelConfig
  ocr: AIModelConfig
  speechCorrection: AIModelConfig
  topicGenerator: AIModelConfig
  planAssistant: AIModelConfig
  quickChatSuggest: AIModelConfig
}

/** ローカル開発用 */
const localAIConfig: AIConfig = {
  chat: {
    model: "google/gemini-2.5-flash",
    temperature: 0.7,
    maxTokens: 2000,
  },
  evaluation: {
    model: "qwen/qwen3-8b",
    temperature: 0,
    maxTokens: 100,
  },
  noteSummary: {
    model: "google/gemini-2.5-flash",
    temperature: 0.3,
    maxTokens: 1000,
  },
  ocr: {
    model: "openai/gpt-4o-mini",
    temperature: 0,
    maxTokens: 2000,
  },
  speechCorrection: {
    model: "qwen/qwen3-8b",
    temperature: 0,
    maxTokens: 500,
  },
  topicGenerator: {
    model: "google/gemini-2.5-flash",
    temperature: 0.5,
    maxTokens: 3000,
  },
  planAssistant: {
    model: "google/gemini-2.5-flash",
    temperature: 0.5,
    maxTokens: 3000,
  },
  quickChatSuggest: {
    model: "google/gemini-2.5-flash",
    temperature: 0,
    maxTokens: 500,
  },
}

/** staging/production用 */
const productionAIConfig: AIConfig = {
  chat: {
    model: "google/gemini-2.5-flash",
    temperature: 0.7,
    maxTokens: 2000,
  },
  evaluation: {
    model: "qwen/qwen3-8b",
    temperature: 0,
    maxTokens: 100,
  },
  noteSummary: {
    model: "google/gemini-2.5-flash",
    temperature: 0.3,
    maxTokens: 1000,
  },
  ocr: {
    model: "openai/gpt-4o-mini",
    temperature: 0,
    maxTokens: 2000,
  },
  speechCorrection: {
    model: "qwen/qwen3-8b",
    temperature: 0,
    maxTokens: 500,
  },
  topicGenerator: {
    model: "google/gemini-2.5-flash",
    temperature: 0.5,
    maxTokens: 3000,
  },
  planAssistant: {
    model: "google/gemini-2.5-flash",
    temperature: 0.5,
    maxTokens: 3000,
  },
  quickChatSuggest: {
    model: "google/gemini-2.5-flash",
    temperature: 0,
    maxTokens: 500,
  },
}

/**
 * 環境に応じたAI設定を解決
 * 将来的にはユーザープランも引数に追加可能
 */
export const resolveAIConfig = (environment: Environment): AIConfig => {
  switch (environment) {
    case "local":
      return localAIConfig
    case "staging":
    case "production":
      return productionAIConfig
  }
}

/** @deprecated resolveAIConfig を使用してください */
export const defaultAIConfig = localAIConfig
