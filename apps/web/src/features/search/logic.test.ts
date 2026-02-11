import { describe, it, expect, vi } from "vitest"
import { getTopicUrl, isSearchShortcut, highlightMatch } from "./logic"

describe("getTopicUrl", () => {
  it("論点詳細へのURLを生成する", () => {
    const result = getTopicUrl({
      id: "topic-1",
      name: "テスト論点",
      description: null,
      studyDomainId: "domain-1",
      subjectId: "subject-1",
      categoryId: "cat-1",
      subjectName: "テスト科目",
      categoryName: "テストカテゴリ",
    })

    expect(result).toBe("/domains/domain-1/subjects/subject-1/cat-1/topic-1")
  })
})

describe("isSearchShortcut", () => {
  it("Ctrl+Kでtrueを返す（Windows/Linux）", () => {
    // navigatorのplatformをモック
    vi.stubGlobal("navigator", { platform: "Win32" })

    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
    })

    expect(isSearchShortcut(event)).toBe(true)
  })

  it("Cmd+Kでtrueを返す（Mac）", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" })

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
    })

    expect(isSearchShortcut(event)).toBe(true)
  })

  it("修飾キーなしのKではfalseを返す", () => {
    vi.stubGlobal("navigator", { platform: "Win32" })

    const event = new KeyboardEvent("keydown", {
      key: "k",
    })

    expect(isSearchShortcut(event)).toBe(false)
  })

  it("Ctrl+他のキーではfalseを返す", () => {
    vi.stubGlobal("navigator", { platform: "Win32" })

    const event = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
    })

    expect(isSearchShortcut(event)).toBe(false)
  })
})

describe("highlightMatch", () => {
  it("クエリが空の場合はハイライトなし", () => {
    const result = highlightMatch("テスト文字列", "")
    expect(result).toEqual([{ text: "テスト文字列", highlight: false }])
  })

  it("マッチしない場合はハイライトなし", () => {
    const result = highlightMatch("テスト文字列", "xyz")
    expect(result).toEqual([{ text: "テスト文字列", highlight: false }])
  })

  it("先頭にマッチする場合", () => {
    const result = highlightMatch("テスト文字列", "テスト")
    expect(result).toEqual([
      { text: "テスト", highlight: true },
      { text: "文字列", highlight: false },
    ])
  })

  it("途中にマッチする場合", () => {
    const result = highlightMatch("テスト文字列です", "文字列")
    expect(result).toEqual([
      { text: "テスト", highlight: false },
      { text: "文字列", highlight: true },
      { text: "です", highlight: false },
    ])
  })

  it("末尾にマッチする場合", () => {
    const result = highlightMatch("テスト文字列", "文字列")
    expect(result).toEqual([
      { text: "テスト", highlight: false },
      { text: "文字列", highlight: true },
    ])
  })

  it("大文字小文字を区別しない", () => {
    const result = highlightMatch("Hello World", "hello")
    expect(result).toEqual([
      { text: "Hello", highlight: true },
      { text: " World", highlight: false },
    ])
  })

  it("全体がマッチする場合", () => {
    const result = highlightMatch("テスト", "テスト")
    expect(result).toEqual([{ text: "テスト", highlight: true }])
  })
})
