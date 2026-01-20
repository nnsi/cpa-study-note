import type { AIAdapter, StreamChunk, GenerateTextInput } from "../types"

type MockResponse = {
  pattern: RegExp | string
  response: string
  delay?: number
}

const defaultMockResponses: MockResponse[] = [
  {
    pattern: /収益認識/,
    response: `収益認識の5ステップモデルについて説明します。

1. **契約の識別**: 顧客との契約を識別します
2. **履行義務の識別**: 契約における個別の履行義務を識別します
3. **取引価格の算定**: 取引価格を算定します
4. **取引価格の配分**: 各履行義務に取引価格を配分します
5. **収益の認識**: 履行義務を充足した時点で収益を認識します

これらのステップを順に適用することで、適切な時期に適切な金額の収益を認識できます。`,
    delay: 30,
  },
  {
    pattern: /リース/,
    response: `リース会計について説明します。

リース取引は、使用権資産（Right-of-use asset）を認識し、リース負債を計上します。

**借手の会計処理**:
- 使用権資産とリース負債を認識
- 使用権資産は減価償却
- リース負債は利息法で償却

**貸手の会計処理**:
- ファイナンス・リースとオペレーティング・リースに分類
- ファイナンス・リース：リース投資資産を認識
- オペレーティング・リース：リース料を収益として認識`,
    delay: 30,
  },
  {
    pattern: /.*/,
    response: `ご質問ありがとうございます。

この論点について説明します。会計基準や監査基準に基づいて、正確な理解を深めていきましょう。

具体的な質問がありましたら、お気軽にお聞きください。`,
    delay: 20,
  },
]

export const createMockAdapter = (customResponses?: MockResponse[]): AIAdapter => {
  const responses = customResponses ?? defaultMockResponses

  const findResponse = (input: GenerateTextInput): MockResponse => {
    const lastMessage = input.messages[input.messages.length - 1]
    const content = lastMessage?.content ?? ""

    return (
      responses.find((r) =>
        typeof r.pattern === "string"
          ? content.includes(r.pattern)
          : r.pattern.test(content)
      ) ?? responses[responses.length - 1]
    )
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  return {
    generateText: async (input) => {
      const mock = findResponse(input)
      await sleep(100)
      return { content: mock.response }
    },

    streamText: async function* (input): AsyncIterable<StreamChunk> {
      const mock = findResponse(input)
      const chars = mock.response.split("")

      for (const char of chars) {
        await sleep(mock.delay ?? 20)
        yield { type: "text", content: char }
      }
      yield { type: "done" }
    },
  }
}
