import type { Environment } from "@/shared/lib/env"

/**
 * AI設定の型定義
 *
 * 環境（local/staging/production）や
 * ユーザープラン（無料/プレミアム）によって異なる設定を返せるように設計
 */
export type AIConfig = {
  chat: {
    model: string
    temperature: number
    maxTokens: number
  }
  evaluation: {
    model: string
    temperature: number
    maxTokens: number
  }
}

/** ローカル開発用（安価なモデル） */
const localAIConfig: AIConfig = {
  chat: {
    model: "z-ai/glm-4.7-flash",
    temperature: 0.7,
    maxTokens: 2000,
  },
  evaluation: {
    model: "z-ai/glm-4.7-flash",
    temperature: 0,
    maxTokens: 100,
  },
}

/** staging/production用 */
const productionAIConfig: AIConfig = {
  chat: {
    model: "z-ai/glm-4.7-flash",
    temperature: 0.7,
    maxTokens: 2000,
  },
  evaluation: {
    model: "z-ai/glm-4.7-flash",
    temperature: 0,
    maxTokens: 100,
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
