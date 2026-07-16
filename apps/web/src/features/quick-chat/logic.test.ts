import { describe, expect, it } from "vitest"
import { findCreatedTopic } from "./logic"

describe("findCreatedTopic", () => {
  it("同名の既存論点ではなく、指定カテゴリに追加された論点を返す", () => {
    const tree = {
      categories: [
        {
          subcategories: [
            { id: "category-old", topics: [{ id: "topic-old", name: "監査証拠" }] },
            { id: "category-new", topics: [{ id: "topic-new", name: "監査証拠" }] },
          ],
        },
      ],
    }

    expect(findCreatedTopic(tree, "監査証拠", new Set(["topic-old"]), "category-new")).toEqual({
      topicId: "topic-new",
      categoryId: "category-new",
    })
  })
})
