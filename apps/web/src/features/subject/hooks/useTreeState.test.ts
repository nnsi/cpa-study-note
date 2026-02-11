import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTreeState } from "./useTreeState"
import type { CategoryNode } from "../api"

const createMockCategories = (): CategoryNode[] => [
  {
    id: "cat-1",
    name: "単元A",
    displayOrder: 0,
    subcategories: [
      {
        id: "sub-1",
        name: "中単元A-1",
        displayOrder: 0,
        topics: [
          {
            id: "topic-1",
            name: "論点1",
            description: null,
            difficulty: null,
            topicType: null,
            aiSystemPrompt: null,
            displayOrder: 0,
          },
          {
            id: "topic-2",
            name: "論点2",
            description: "説明文",
            difficulty: null,
            topicType: null,
            aiSystemPrompt: null,
            displayOrder: 1,
          },
        ],
      },
    ],
  },
  {
    id: "cat-2",
    name: "単元B",
    displayOrder: 1,
    subcategories: [],
  },
]

describe("useTreeState", () => {
  it("初期状態が正しく設定される", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    expect(result.current.categories).toHaveLength(2)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.categories[0].name).toBe("単元A")
    expect(result.current.categories[0].subcategories[0].topics).toHaveLength(2)
  })

  it("空配列で初期化できる", () => {
    const { result } = renderHook(() => useTreeState([]))

    expect(result.current.categories).toEqual([])
    expect(result.current.isDirty).toBe(false)
  })

  it("カテゴリを追加する", () => {
    const { result } = renderHook(() => useTreeState([]))

    act(() => {
      result.current.addCategory("テスト単元")
    })

    expect(result.current.categories).toHaveLength(1)
    expect(result.current.categories[0].name).toBe("テスト単元")
    expect(result.current.categories[0].id).toBeNull()
    expect(result.current.isDirty).toBe(true)
  })

  it("カテゴリ名を更新する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.updateCategory(0, "更新された単元A")
    })

    expect(result.current.categories[0].name).toBe("更新された単元A")
    expect(result.current.isDirty).toBe(true)
  })

  it("カテゴリを削除する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.deleteCategory(0)
    })

    expect(result.current.categories).toHaveLength(1)
    expect(result.current.categories[0].name).toBe("単元B")
    expect(result.current.isDirty).toBe(true)
  })

  it("サブカテゴリを追加する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.addSubcategory(1, "新しい中単元")
    })

    expect(result.current.categories[1].subcategories).toHaveLength(1)
    expect(result.current.categories[1].subcategories[0].name).toBe(
      "新しい中単元"
    )
    expect(result.current.isDirty).toBe(true)
  })

  it("サブカテゴリ名を更新する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.updateSubcategory(0, 0, "更新された中単元")
    })

    expect(result.current.categories[0].subcategories[0].name).toBe(
      "更新された中単元"
    )
    expect(result.current.isDirty).toBe(true)
  })

  it("サブカテゴリを削除する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.deleteSubcategory(0, 0)
    })

    expect(result.current.categories[0].subcategories).toHaveLength(0)
    expect(result.current.isDirty).toBe(true)
  })

  it("論点を追加する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.addTopic(0, 0, "新しい論点")
    })

    expect(result.current.categories[0].subcategories[0].topics).toHaveLength(3)
    expect(
      result.current.categories[0].subcategories[0].topics[2].name
    ).toBe("新しい論点")
    expect(result.current.isDirty).toBe(true)
  })

  it("論点を更新する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.updateTopic(0, 0, 0, { name: "更新された論点" })
    })

    expect(
      result.current.categories[0].subcategories[0].topics[0].name
    ).toBe("更新された論点")
    expect(result.current.isDirty).toBe(true)
  })

  it("論点を削除する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.deleteTopic(0, 0, 0)
    })

    expect(result.current.categories[0].subcategories[0].topics).toHaveLength(1)
    expect(
      result.current.categories[0].subcategories[0].topics[0].name
    ).toBe("論点2")
    expect(result.current.isDirty).toBe(true)
  })

  it("カテゴリを移動する", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    act(() => {
      result.current.moveCategory(0, 1)
    })

    expect(result.current.categories[0].name).toBe("単元B")
    expect(result.current.categories[1].name).toBe("単元A")
    expect(result.current.categories[0].displayOrder).toBe(0)
    expect(result.current.categories[1].displayOrder).toBe(1)
    expect(result.current.isDirty).toBe(true)
  })

  it("resetFromApiでAPIデータから状態をリセットする", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    // 変更を加える
    act(() => {
      result.current.addCategory("追加カテゴリ")
    })

    expect(result.current.isDirty).toBe(true)
    expect(result.current.categories).toHaveLength(3)

    // リセット
    act(() => {
      result.current.resetFromApi(createMockCategories())
    })

    expect(result.current.isDirty).toBe(false)
    expect(result.current.categories).toHaveLength(2)
  })

  it("getUpdatePayloadが正しいペイロードを返す", () => {
    const { result } = renderHook(() =>
      useTreeState(createMockCategories())
    )

    const payload = result.current.getUpdatePayload()

    expect(payload.categories).toHaveLength(2)
    expect(payload.categories[0].displayOrder).toBe(0)
    expect(payload.categories[1].displayOrder).toBe(1)
    expect(payload.categories[0].subcategories[0].displayOrder).toBe(0)
  })
})
