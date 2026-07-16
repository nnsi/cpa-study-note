import { describe, expect, it } from "vitest"
import type { TocSuggestion, TreeResponse } from "@cpa-study/shared/schemas"
import {
  countSelectedTopics,
  mergeIntoTree,
  parseTocSuggestionsFromText,
  renameNode,
  toEditableTree,
  toggleNode,
} from "./logic"

const suggestions: TocSuggestion = {
  categories: [
    {
      name: "財務会計",
      subcategories: [
        {
          name: "棚卸資産",
          topics: [{ name: "取得原価" }, { name: "期末評価" }],
        },
        {
          name: "固定資産",
          topics: [{ name: "減価償却" }],
        },
      ],
    },
  ],
}

const currentTree: TreeResponse = {
  categories: [
    {
      id: "category-existing",
      name: "財務会計",
      displayOrder: 3,
      subcategories: [
        {
          id: "subcategory-existing",
          name: "棚卸資産",
          displayOrder: 2,
          topics: [
            {
              id: "topic-existing",
              name: "取得原価",
              description: "既存の説明",
              difficulty: "basic",
              topicType: "calculation",
              aiSystemPrompt: "既存プロンプト",
              displayOrder: 4,
            },
          ],
        },
      ],
    },
    {
      id: "category-other",
      name: "監査論",
      displayOrder: 7,
      subcategories: [],
    },
  ],
}

describe("parseTocSuggestionsFromText", () => {
  it("jsonフェンス内の提案をパースする", () => {
    const text = `説明です。\n\`\`\`json\n${JSON.stringify(suggestions)}\n\`\`\``
    expect(parseTocSuggestionsFromText(text)).toEqual(suggestions)
  })

  it("フェンスなしで周囲に文章があってもパースする", () => {
    const text = `結果: ${JSON.stringify(suggestions)} 以上です。`
    expect(parseTocSuggestionsFromText(text)).toEqual(suggestions)
  })

  it("ゴミテキストはnullを返す", () => {
    expect(parseTocSuggestionsFromText("目次を読み取れませんでした {broken}"))
      .toBeNull()
  })
})

describe("編集可能ツリー", () => {
  it("全ノードを選択し、indexパスのkeyを付ける", () => {
    const tree = toEditableTree(suggestions)
    expect(tree[0].key).toBe("0")
    expect(tree[0].subcategories[1].key).toBe("0-1")
    expect(tree[0].subcategories[0].topics[1].key).toBe("0-0-1")
    expect(countSelectedTopics(tree)).toBe(3)
  })

  it("カテゴリの切り替えを全子孫へカスケードする", () => {
    const tree = toggleNode(toEditableTree(suggestions), "0")
    expect(tree[0].selected).toBe(false)
    expect(tree[0].subcategories.every((subcategory) => !subcategory.selected)).toBe(true)
    expect(
      tree[0].subcategories.every((subcategory) =>
        subcategory.topics.every((topic) => !topic.selected)
      )
    ).toBe(true)
  })

  it("論点の切り替え後に親を子が一つでも選択中かで再計算する", () => {
    let tree = toEditableTree(suggestions)
    tree = toggleNode(tree, "0-0-0")
    expect(tree[0].subcategories[0].selected).toBe(true)
    expect(tree[0].selected).toBe(true)

    tree = toggleNode(tree, "0-0-1")
    expect(tree[0].subcategories[0].selected).toBe(false)
    expect(tree[0].selected).toBe(true)

    tree = toggleNode(tree, "0-1-0")
    expect(tree[0].selected).toBe(false)
  })

  it("指定したノードだけをリネームする", () => {
    const tree = renameNode(toEditableTree(suggestions), "0-0-1", "低価法")
    expect(tree[0].subcategories[0].topics[1].name).toBe("低価法")
    expect(tree[0].subcategories[0].topics[0].name).toBe("取得原価")
  })
})

describe("mergeIntoTree", () => {
  it("既存カテゴリとサブカテゴリのidを再利用し、同名論点をスキップする", () => {
    const merged = mergeIntoTree(currentTree, toEditableTree(suggestions))
    const category = merged.find((item) => item.name === "財務会計")
    const subcategory = category?.subcategories.find((item) => item.name === "棚卸資産")

    expect(category?.id).toBe("category-existing")
    expect(subcategory?.id).toBe("subcategory-existing")
    expect(subcategory?.topics.filter((topic) => topic.name === "取得原価")).toHaveLength(1)
    expect(subcategory?.topics.find((topic) => topic.name === "取得原価")?.id)
      .toBe("topic-existing")
    expect(subcategory?.topics.find((topic) => topic.name === "期末評価")?.displayOrder)
      .toBe(5)
  })

  it("新規カテゴリを既存の最大displayOrder+1で追加する", () => {
    const editable = toEditableTree({
      categories: [
        {
          name: "企業法",
          subcategories: [{ name: "会社法", topics: [{ name: "設立" }] }],
        },
      ],
    })
    const merged = mergeIntoTree(currentTree, editable)
    const category = merged.find((item) => item.name === "企業法")

    expect(category?.id).toBeNull()
    expect(category?.displayOrder).toBe(8)
  })

  it("未選択サブツリーと空名の枝を追加しない", () => {
    let editable = toEditableTree({
      categories: [
        {
          name: "企業法",
          subcategories: [
            { name: "会社法", topics: [{ name: "設立" }] },
            { name: "商法", topics: [{ name: "商行為" }] },
          ],
        },
        {
          name: "   ",
          subcategories: [{ name: "空カテゴリ", topics: [{ name: "論点" }] }],
        },
      ],
    })
    editable = toggleNode(editable, "0-1")
    const merged = mergeIntoTree(currentTree, editable)
    const category = merged.find((item) => item.name === "企業法")

    expect(category?.subcategories.map((item) => item.name)).toEqual(["会社法"])
    expect(merged.some((item) => item.name === "")).toBe(false)
  })

  it("同名サブカテゴリはカテゴリごとの2階層パス内でのみ再利用する", () => {
    const editable = toEditableTree({
      categories: [
        {
          name: "財務会計",
          subcategories: [{ name: "共通", topics: [{ name: "論点A" }] }],
        },
        {
          name: "管理会計",
          subcategories: [{ name: "共通", topics: [{ name: "論点B" }] }],
        },
      ],
    })
    const merged = mergeIntoTree(currentTree, editable)
    const financial = merged.find((item) => item.name === "財務会計")
    const management = merged.find((item) => item.name === "管理会計")

    expect(financial?.subcategories.find((item) => item.name === "共通")?.topics[0].name)
      .toBe("論点A")
    expect(management?.subcategories.find((item) => item.name === "共通")?.topics[0].name)
      .toBe("論点B")
    expect(financial?.subcategories.find((item) => item.name === "共通")?.id).toBeNull()
    expect(management?.subcategories.find((item) => item.name === "共通")?.id).toBeNull()
  })
})
