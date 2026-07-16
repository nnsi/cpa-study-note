import {
  tocSuggestionSchema,
  type CategoryNode,
  type TocSuggestion,
  type TreeResponse,
} from "@cpa-study/shared/schemas"

export type EditableTopic = {
  key: string
  name: string
  selected: boolean
}

export type EditableSubcategory = {
  key: string
  name: string
  selected: boolean
  topics: EditableTopic[]
}

export type EditableCategory = {
  key: string
  name: string
  selected: boolean
  subcategories: EditableSubcategory[]
}

/** AIの応答から、波括弧が釣り合ったJSONオブジェクトを順に取り出す。 */
const findJsonObjects = (text: string): string[] => {
  const objects: string[] = []

  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0
    let inString = false
    let escaped = false

    for (let index = start; index < text.length; index++) {
      const character = text[index]

      if (inString) {
        if (escaped) {
          escaped = false
        } else if (character === "\\") {
          escaped = true
        } else if (character === '"') {
          inString = false
        }
        continue
      }

      if (character === '"') {
        inString = true
      } else if (character === "{") {
        depth++
      } else if (character === "}") {
        depth--
        if (depth === 0) {
          objects.push(text.slice(start, index + 1))
          break
        }
      }
    }
  }

  return objects
}

/** AIレスポンステキストから目次JSONを取り出し、共有スキーマで検証する。 */
export const parseTocSuggestionsFromText = (text: string): TocSuggestion | null => {
  const tryParse = (json: string): TocSuggestion | null => {
    try {
      const result = tocSuggestionSchema.safeParse(JSON.parse(json))
      return result.success ? result.data : null
    } catch {
      return null
    }
  }

  const fencedJson = text.match(/```json\s*([\s\S]*?)```/)
  if (fencedJson) {
    const parsed = tryParse(fencedJson[1].trim())
    if (parsed) return parsed
  }

  for (const json of findJsonObjects(text)) {
    const parsed = tryParse(json)
    if (parsed) return parsed
  }

  return null
}

/** 提案を決定的なindexパス付きの全選択ツリーへ変換する。 */
export const toEditableTree = (suggestions: TocSuggestion): EditableCategory[] =>
  suggestions.categories.map((category, categoryIndex) => ({
    key: `${categoryIndex}`,
    name: category.name,
    selected: true,
    subcategories: category.subcategories.map((subcategory, subcategoryIndex) => ({
      key: `${categoryIndex}-${subcategoryIndex}`,
      name: subcategory.name,
      selected: true,
      topics: subcategory.topics.map((topic, topicIndex) => ({
        key: `${categoryIndex}-${subcategoryIndex}-${topicIndex}`,
        name: topic.name,
        selected: true,
      })),
    })),
  }))

const cascadeSubcategory = (
  subcategory: EditableSubcategory,
  selected: boolean
): EditableSubcategory => ({
  ...subcategory,
  selected,
  topics: subcategory.topics.map((topic) => ({ ...topic, selected })),
})

/** 指定ノードを反転し、子孫へのカスケードと親の選択状態の再計算を行う。 */
export const toggleNode = (
  tree: EditableCategory[],
  key: string
): EditableCategory[] =>
  tree.map((category) => {
    if (category.key === key) {
      const selected = !category.selected
      return {
        ...category,
        selected,
        subcategories: category.subcategories.map((subcategory) =>
          cascadeSubcategory(subcategory, selected)
        ),
      }
    }

    const subcategories = category.subcategories.map((subcategory) => {
      if (subcategory.key === key) {
        return cascadeSubcategory(subcategory, !subcategory.selected)
      }

      const topics = subcategory.topics.map((topic) =>
        topic.key === key ? { ...topic, selected: !topic.selected } : topic
      )

      return {
        ...subcategory,
        topics,
        selected: topics.some((topic) => topic.selected),
      }
    })

    return {
      ...category,
      subcategories,
      selected: subcategories.some((subcategory) => subcategory.selected),
    }
  })

/** 指定ノードの表示名だけを更新する。空名の除外とtrimはマージ時に行う。 */
export const renameNode = (
  tree: EditableCategory[],
  key: string,
  name: string
): EditableCategory[] =>
  tree.map((category) => ({
    ...category,
    name: category.key === key ? name : category.name,
    subcategories: category.subcategories.map((subcategory) => ({
      ...subcategory,
      name: subcategory.key === key ? name : subcategory.name,
      topics: subcategory.topics.map((topic) =>
        topic.key === key ? { ...topic, name } : topic
      ),
    })),
  }))

/** 選択中の論点数を返す。 */
export const countSelectedTopics = (tree: EditableCategory[]): number =>
  tree.reduce(
    (categoryTotal, category) =>
      categoryTotal +
      category.subcategories.reduce(
        (subcategoryTotal, subcategory) =>
          subcategoryTotal + subcategory.topics.filter((topic) => topic.selected).length,
        0
      ),
    0
  )

const toCategoryInput = (category: TreeResponse["categories"][number]): CategoryNode => ({
  id: category.id,
  name: category.name,
  displayOrder: category.displayOrder,
  subcategories: category.subcategories.map((subcategory) => ({
    id: subcategory.id,
    name: subcategory.name,
    displayOrder: subcategory.displayOrder,
    topics: subcategory.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      difficulty: topic.difficulty,
      topicType: topic.topicType,
      aiSystemPrompt: topic.aiSystemPrompt,
      displayOrder: topic.displayOrder,
    })),
  })),
})

/** 編集済みの目次提案を既存ツリーへ名前完全一致でマージする。 */
export const mergeIntoTree = (
  currentTree: TreeResponse,
  editable: EditableCategory[]
): CategoryNode[] => {
  const categories = currentTree.categories.map(toCategoryInput)
  let maxCategoryOrder = Math.max(
    ...categories.map((category) => category.displayOrder),
    -1
  )

  for (const editableCategory of editable) {
    const categoryName = editableCategory.name.trim()
    if (!editableCategory.selected || !categoryName) continue

    const subcategories = editableCategory.subcategories
      .filter((subcategory) => subcategory.selected && subcategory.name.trim())
      .map((subcategory) => ({
        name: subcategory.name.trim(),
        topics: subcategory.topics
          .filter((topic) => topic.selected && topic.name.trim())
          .map((topic) => topic.name.trim()),
      }))
      .filter((subcategory) => subcategory.topics.length > 0)

    if (subcategories.length === 0) continue

    let targetCategory = categories.find(
      (category) => category.name.trim() === categoryName
    )

    if (!targetCategory) {
      targetCategory = {
        id: null,
        name: categoryName,
        displayOrder: ++maxCategoryOrder,
        subcategories: [],
      }
      categories.push(targetCategory)
    }

    let maxSubcategoryOrder = Math.max(
      ...targetCategory.subcategories.map((subcategory) => subcategory.displayOrder),
      -1
    )

    for (const editableSubcategory of subcategories) {
      let targetSubcategory = targetCategory.subcategories.find(
        (subcategory) => subcategory.name.trim() === editableSubcategory.name
      )

      if (!targetSubcategory) {
        targetSubcategory = {
          id: null,
          name: editableSubcategory.name,
          displayOrder: ++maxSubcategoryOrder,
          topics: [],
        }
        targetCategory.subcategories.push(targetSubcategory)
      }

      let maxTopicOrder = Math.max(
        ...targetSubcategory.topics.map((topic) => topic.displayOrder),
        -1
      )

      for (const topicName of editableSubcategory.topics) {
        const exists = targetSubcategory.topics.some(
          (topic) => topic.name.trim() === topicName
        )
        if (exists) continue

        targetSubcategory.topics.push({
          id: null,
          name: topicName,
          description: null,
          difficulty: null,
          topicType: null,
          aiSystemPrompt: null,
          displayOrder: ++maxTopicOrder,
        })
      }
    }
  }

  return categories
}
