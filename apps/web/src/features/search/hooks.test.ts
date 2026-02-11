import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSearchModal, useSearchNavigation } from "./hooks"

describe("useSearchModal", () => {
  it("初期状態は閉じている", () => {
    const { result } = renderHook(() => useSearchModal())

    expect(result.current.isOpen).toBe(false)
    expect(result.current.query).toBe("")
  })

  it("openでモーダルを開く", () => {
    const { result } = renderHook(() => useSearchModal())

    act(() => {
      result.current.open()
    })

    expect(result.current.isOpen).toBe(true)
  })

  it("closeでモーダルを閉じてクエリをクリアする", () => {
    const { result } = renderHook(() => useSearchModal())

    act(() => {
      result.current.open()
      result.current.setQuery("テスト")
    })

    expect(result.current.isOpen).toBe(true)
    expect(result.current.query).toBe("テスト")

    act(() => {
      result.current.close()
    })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.query).toBe("")
  })

  it("toggleで開閉を切り替える", () => {
    const { result } = renderHook(() => useSearchModal())

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isOpen).toBe(false)
    expect(result.current.query).toBe("")
  })

  it("クエリを設定できる", () => {
    const { result } = renderHook(() => useSearchModal())

    act(() => {
      result.current.setQuery("検索ワード")
    })

    expect(result.current.query).toBe("検索ワード")
  })
})

describe("useSearchNavigation", () => {
  const mockResults = [
    {
      id: "topic-1",
      name: "論点A",
      description: null,
      studyDomainId: "d1",
      subjectId: "s1",
      categoryId: "c1",
      subjectName: "科目A",
      categoryName: "カテゴリA",
    },
    {
      id: "topic-2",
      name: "論点B",
      description: null,
      studyDomainId: "d1",
      subjectId: "s1",
      categoryId: "c1",
      subjectName: "科目A",
      categoryName: "カテゴリB",
    },
    {
      id: "topic-3",
      name: "論点C",
      description: null,
      studyDomainId: "d1",
      subjectId: "s2",
      categoryId: "c2",
      subjectName: "科目B",
      categoryName: "カテゴリC",
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("初期状態でselectedIndexが0", () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useSearchNavigation(mockResults, onSelect)
    )

    expect(result.current.selectedIndex).toBe(0)
  })

  it("ArrowDownで次の項目に移動する", () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useSearchNavigation(mockResults, onSelect)
    )

    act(() => {
      result.current.handleKeyDown({
        key: "ArrowDown",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.selectedIndex).toBe(1)
  })

  it("ArrowDownで最後からループする", () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useSearchNavigation(mockResults, onSelect)
    )

    // 最後の項目に移動
    act(() => {
      result.current.setSelectedIndex(2)
    })

    act(() => {
      result.current.handleKeyDown({
        key: "ArrowDown",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.selectedIndex).toBe(0)
  })

  it("ArrowUpで前の項目に移動する", () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useSearchNavigation(mockResults, onSelect)
    )

    act(() => {
      result.current.setSelectedIndex(2)
    })

    act(() => {
      result.current.handleKeyDown({
        key: "ArrowUp",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.selectedIndex).toBe(1)
  })

  it("ArrowUpで最初からループする", () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useSearchNavigation(mockResults, onSelect)
    )

    act(() => {
      result.current.handleKeyDown({
        key: "ArrowUp",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.selectedIndex).toBe(2)
  })

  it("Enterで選択した項目をonSelectに渡す", () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useSearchNavigation(mockResults, onSelect)
    )

    act(() => {
      result.current.setSelectedIndex(1)
    })

    act(() => {
      result.current.handleKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(onSelect).toHaveBeenCalledWith(mockResults[1])
  })

  it("結果が空の場合はキー操作が無効", () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() =>
      useSearchNavigation([], onSelect)
    )

    act(() => {
      result.current.handleKeyDown({
        key: "ArrowDown",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.selectedIndex).toBe(0)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("結果が変わるとselectedIndexが0にリセットされる", () => {
    const onSelect = vi.fn()
    const { result, rerender } = renderHook(
      ({ results }) => useSearchNavigation(results, onSelect),
      { initialProps: { results: mockResults } }
    )

    act(() => {
      result.current.setSelectedIndex(2)
    })

    expect(result.current.selectedIndex).toBe(2)

    // 結果を変更
    rerender({ results: [mockResults[0]] })

    expect(result.current.selectedIndex).toBe(0)
  })
})
