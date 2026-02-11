import { describe, it, expect } from "vitest"
import {
  parseSuggestionsFromText,
  createInitialSelection,
  countSelected,
  toggleTopic,
  toggleCategory,
  type SuggestionsResult,
} from "./logic"

describe("parseSuggestionsFromText", () => {
  it("```json```ブロックからJSONをパースできる", () => {
    const text = `棚卸資産に関する論点です。

\`\`\`json
{
  "categories": [
    {
      "name": "棚卸資産",
      "topics": [
        { "name": "定義", "description": "棚卸資産の定義を理解する" }
      ]
    }
  ]
}
\`\`\``
    const result = parseSuggestionsFromText(text)
    expect(result).not.toBeNull()
    expect(result!.categories).toHaveLength(1)
    expect(result!.categories[0].name).toBe("棚卸資産")
    expect(result!.categories[0].topics).toHaveLength(1)
    expect(result!.categories[0].topics[0].name).toBe("定義")
  })

  it("JSONブロックなしでも最後の{...}からパースを試みる", () => {
    // フォールバック: テキスト末尾がJSON閉じ括弧で終わるケース
    const json = '{"categories":[{"name":"テスト","topics":[{"name":"論点1","description":null}]}]}'
    const text = `提案します。\n${json}`
    const result = parseSuggestionsFromText(text)
    expect(result).not.toBeNull()
    expect(result!.categories[0].name).toBe("テスト")
  })

  it("不正なJSONの場合はnullを返す", () => {
    const text = "これはただのテキストです。JSONは含まれていません。"
    const result = parseSuggestionsFromText(text)
    expect(result).toBeNull()
  })

  it("categories配列がないJSONはnullを返す（Zodバリデーション）", () => {
    const text = '```json\n{"items": [{"name": "test"}]}\n```'
    const result = parseSuggestionsFromText(text)
    expect(result).toBeNull()
  })

  it("descriptionがnullの場合もパースできる", () => {
    const text =
      '```json\n{"categories":[{"name":"C1","topics":[{"name":"T1","description":null}]}]}\n```'
    const result = parseSuggestionsFromText(text)
    expect(result).not.toBeNull()
    expect(result!.categories[0].topics[0].description).toBeNull()
  })

  it("descriptionが省略された場合もデフォルトでnullになる", () => {
    const text =
      '```json\n{"categories":[{"name":"C1","topics":[{"name":"T1"}]}]}\n```'
    const result = parseSuggestionsFromText(text)
    expect(result).not.toBeNull()
    expect(result!.categories[0].topics[0].description).toBeNull()
  })

  it("空のcategories配列でもパースできる", () => {
    const text = '```json\n{"categories":[]}\n```'
    const result = parseSuggestionsFromText(text)
    expect(result).not.toBeNull()
    expect(result!.categories).toEqual([])
  })

  it("複数カテゴリ・複数論点をパースできる", () => {
    const text = `\`\`\`json
{
  "categories": [
    {
      "name": "カテゴリA",
      "topics": [
        { "name": "論点1", "description": "説明1" },
        { "name": "論点2", "description": "説明2" }
      ]
    },
    {
      "name": "カテゴリB",
      "topics": [
        { "name": "論点3", "description": null }
      ]
    }
  ]
}
\`\`\``
    const result = parseSuggestionsFromText(text)
    expect(result!.categories).toHaveLength(2)
    expect(result!.categories[0].topics).toHaveLength(2)
    expect(result!.categories[1].topics).toHaveLength(1)
  })
})

describe("createInitialSelection", () => {
  const suggestions: SuggestionsResult = {
    categories: [
      {
        name: "カテゴリA",
        topics: [
          { name: "論点1", description: "説明1" },
          { name: "論点2", description: null },
        ],
      },
      {
        name: "カテゴリB",
        topics: [{ name: "論点3", description: null }],
      },
    ],
  }

  it("全ての論点が選択された状態で初期化される", () => {
    const selection = createInitialSelection(suggestions)
    expect(selection.get("カテゴリA")?.size).toBe(2)
    expect(selection.get("カテゴリB")?.size).toBe(1)
    expect(selection.get("カテゴリA")?.has("論点1")).toBe(true)
    expect(selection.get("カテゴリA")?.has("論点2")).toBe(true)
    expect(selection.get("カテゴリB")?.has("論点3")).toBe(true)
  })
})

describe("countSelected", () => {
  it("選択された論点の合計数を返す", () => {
    const selection = new Map([
      ["A", new Set(["t1", "t2"])],
      ["B", new Set(["t3"])],
    ])
    expect(countSelected(selection)).toBe(3)
  })

  it("空の選択は0を返す", () => {
    expect(countSelected(new Map())).toBe(0)
  })
})

describe("toggleTopic", () => {
  it("選択中の論点を解除できる", () => {
    const selection = new Map([["A", new Set(["t1", "t2"])]])
    const result = toggleTopic(selection, "A", "t1")
    expect(result.get("A")?.has("t1")).toBe(false)
    expect(result.get("A")?.has("t2")).toBe(true)
  })

  it("未選択の論点を選択できる", () => {
    const selection = new Map([["A", new Set(["t1"])]])
    const result = toggleTopic(selection, "A", "t2")
    expect(result.get("A")?.has("t1")).toBe(true)
    expect(result.get("A")?.has("t2")).toBe(true)
  })

  it("元の選択状態を変更しない（イミュータブル）", () => {
    const original = new Map([["A", new Set(["t1"])]])
    toggleTopic(original, "A", "t1")
    expect(original.get("A")?.has("t1")).toBe(true)
  })
})

describe("toggleCategory", () => {
  it("全選択状態のカテゴリを全解除する", () => {
    const selection = new Map([["A", new Set(["t1", "t2"])]])
    const result = toggleCategory(selection, "A", ["t1", "t2"])
    expect(result.get("A")?.size).toBe(0)
  })

  it("一部選択のカテゴリを全選択にする", () => {
    const selection = new Map([["A", new Set(["t1"])]])
    const result = toggleCategory(selection, "A", ["t1", "t2", "t3"])
    expect(result.get("A")?.size).toBe(3)
  })

  it("未選択のカテゴリを全選択にする", () => {
    const selection = new Map([["A", new Set<string>()]])
    const result = toggleCategory(selection, "A", ["t1", "t2"])
    expect(result.get("A")?.size).toBe(2)
  })

  it("元の選択状態を変更しない（イミュータブル）", () => {
    const original = new Map([["A", new Set(["t1", "t2"])]])
    toggleCategory(original, "A", ["t1", "t2"])
    expect(original.get("A")?.size).toBe(2)
  })
})

// ========================================
// 境界値テスト
// ========================================

describe("parseSuggestionsFromText - 境界値", () => {
  it("空文字入力→null", () => {
    expect(parseSuggestionsFromText("")).toBeNull()
  })

  it("空白のみの入力→null", () => {
    expect(parseSuggestionsFromText("   \n\t  ")).toBeNull()
  })
})

describe("toggleTopic - 境界値", () => {
  it("存在しないカテゴリ名→新しくキーが作られてtopicが追加される", () => {
    const selection = new Map([["A", new Set(["t1"])]])
    const result = toggleTopic(selection, "B", "t2")
    expect(result.has("B")).toBe(true)
    expect(result.get("B")?.has("t2")).toBe(true)
    // 既存のカテゴリAはそのまま
    expect(result.get("A")?.has("t1")).toBe(true)
  })
})

describe("toggleCategory - 境界値", () => {
  it("allTopics空配列→全選択状態の判定でcurrent.size===0===allTopics.lengthでtrueになり全解除される", () => {
    const selection = new Map([["A", new Set<string>()]])
    const result = toggleCategory(selection, "A", [])
    // current.size (0) === allTopics.length (0) → true → 全解除（空Setが設定される）
    expect(result.get("A")?.size).toBe(0)
  })
})

describe("countSelected - 境界値", () => {
  it("カテゴリはあるがtopicsが空Setのケース→0", () => {
    const selection = new Map([
      ["A", new Set<string>()],
      ["B", new Set<string>()],
    ])
    expect(countSelected(selection)).toBe(0)
  })
})
