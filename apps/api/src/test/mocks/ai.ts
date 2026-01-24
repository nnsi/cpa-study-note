/**
 * AIAdapter のモック
 * テスト用に固定レスポンスを返す
 */
import type { AIAdapter, GenerateTextInput, StreamTextInput, StreamChunk } from "@/shared/lib/ai"

export type MockAIOptions = {
  textResponse?: string
  streamChunks?: string[]
  shouldError?: boolean
  errorMessage?: string
}

export const createMockAIAdapter = (options: MockAIOptions = {}): AIAdapter => {
  const {
    textResponse = "Mock AI response",
    streamChunks = ["Mock ", "streaming ", "response"],
    shouldError = false,
    errorMessage = "Mock AI error",
  } = options

  return {
    generateText: async (_input: GenerateTextInput) => {
      if (shouldError) {
        throw new Error(errorMessage)
      }
      return { content: textResponse }
    },

    streamText: async function* (_input: StreamTextInput): AsyncIterable<StreamChunk> {
      if (shouldError) {
        throw new Error(errorMessage)
      }
      for (const chunk of streamChunks) {
        yield { type: "text", content: chunk }
      }
      yield { type: "done" }
    },
  }
}

// 特定のシナリオ用のプリセット
export const mockAIPresets = {
  // OCR用レスポンス
  ocr: createMockAIAdapter({
    textResponse: "抽出されたテキスト: 有価証券の評価損益は、洗替法により処理する。",
  }),

  // チャット用レスポンス
  chat: createMockAIAdapter({
    streamChunks: [
      "有価証券の評価について説明します。\n\n",
      "**売買目的有価証券**は時価評価され、",
      "評価差額は当期の損益として計上されます。",
    ],
  }),

  // 質問評価用レスポンス
  questionEvaluation: {
    good: createMockAIAdapter({
      textResponse: JSON.stringify({
        quality: "good",
        reason: "具体的な論点を指摘した良い質問です。",
      }),
    }),
    surface: createMockAIAdapter({
      textResponse: JSON.stringify({
        quality: "surface",
        reason: "より具体的に質問すると良いでしょう。",
      }),
    }),
  },

  // ノート要約用レスポンス
  noteSummary: createMockAIAdapter({
    textResponse: `## 要約
有価証券の評価方法について学習しました。

## 重要ポイント
- 売買目的有価証券は時価評価
- 満期保有目的は償却原価法

## 理解度
基本的な概念は理解できています。`,
  }),

  // エラー用
  error: createMockAIAdapter({
    shouldError: true,
    errorMessage: "AI service temporarily unavailable",
  }),
}
