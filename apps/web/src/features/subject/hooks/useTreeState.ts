import { useState, useCallback } from "react"
import type {
  CategoryNode,
  CategoryNodeInput,
  TopicNodeInput,
  UpdateTreeInput,
} from "../api"

export type TreeState = {
  categories: CategoryNodeInput[]
}

// Convert API response to editable state
function toEditableTree(categories: CategoryNode[]): CategoryNodeInput[] {
  return categories.map((cat, catIdx) => ({
    id: cat.id,
    name: cat.name,
    displayOrder: cat.displayOrder ?? catIdx,
    topics: cat.topics.map((topic, topicIdx) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      difficulty: topic.difficulty,
      topicType: topic.topicType,
      aiSystemPrompt: topic.aiSystemPrompt,
      displayOrder: topic.displayOrder ?? topicIdx,
    })),
  }))
}

export function useTreeState(initialCategories: CategoryNode[] = []) {
  const [categories, setCategories] = useState<CategoryNodeInput[]>(() =>
    toEditableTree(initialCategories)
  )
  const [isDirty, setIsDirty] = useState(false)

  // Reset state from API data
  const resetFromApi = useCallback((apiCategories: CategoryNode[]) => {
    setCategories(toEditableTree(apiCategories))
    setIsDirty(false)
  }, [])

  // Add category
  const addCategory = useCallback((name: string = "新しいカテゴリ") => {
    setCategories((prev) => [
      ...prev,
      {
        id: null,
        name,
        displayOrder: prev.length,
        topics: [],
      },
    ])
    setIsDirty(true)
  }, [])

  // Update category name
  const updateCategory = useCallback((categoryIdx: number, name: string) => {
    setCategories((prev) =>
      prev.map((cat, idx) => (idx === categoryIdx ? { ...cat, name } : cat))
    )
    setIsDirty(true)
  }, [])

  // Delete category
  const deleteCategory = useCallback((categoryIdx: number) => {
    setCategories((prev) => prev.filter((_, idx) => idx !== categoryIdx))
    setIsDirty(true)
  }, [])

  // Add topic
  const addTopic = useCallback(
    (categoryIdx: number, name: string = "新しい論点") => {
      setCategories((prev) =>
        prev.map((cat, catIdx) =>
          catIdx === categoryIdx
            ? {
                ...cat,
                topics: [
                  ...cat.topics,
                  {
                    id: null,
                    name,
                    description: null,
                    difficulty: null,
                    topicType: null,
                    aiSystemPrompt: null,
                    displayOrder: cat.topics.length,
                  },
                ],
              }
            : cat
        )
      )
      setIsDirty(true)
    },
    []
  )

  // Update topic
  const updateTopic = useCallback(
    (
      categoryIdx: number,
      topicIdx: number,
      updates: Partial<TopicNodeInput>
    ) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) =>
          catIdx === categoryIdx
            ? {
                ...cat,
                topics: cat.topics.map((topic, tIdx) =>
                  tIdx === topicIdx ? { ...topic, ...updates } : topic
                ),
              }
            : cat
        )
      )
      setIsDirty(true)
    },
    []
  )

  // Delete topic
  const deleteTopic = useCallback(
    (categoryIdx: number, topicIdx: number) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) =>
          catIdx === categoryIdx
            ? {
                ...cat,
                topics: cat.topics.filter((_, tIdx) => tIdx !== topicIdx),
              }
            : cat
        )
      )
      setIsDirty(true)
    },
    []
  )

  // Move category (reorder)
  const moveCategory = useCallback((fromIdx: number, toIdx: number) => {
    setCategories((prev) => {
      const newCategories = [...prev]
      const [moved] = newCategories.splice(fromIdx, 1)
      newCategories.splice(toIdx, 0, moved)
      return newCategories.map((cat, idx) => ({ ...cat, displayOrder: idx }))
    })
    setIsDirty(true)
  }, [])

  // Move topic within same category
  const moveTopic = useCallback(
    (categoryIdx: number, fromIdx: number, toIdx: number) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) => {
          if (catIdx !== categoryIdx) return cat
          const newTopics = [...cat.topics]
          const [moved] = newTopics.splice(fromIdx, 1)
          newTopics.splice(toIdx, 0, moved)
          return {
            ...cat,
            topics: newTopics.map((t, idx) => ({ ...t, displayOrder: idx })),
          }
        })
      )
      setIsDirty(true)
    },
    []
  )

  // Get update payload for API
  const getUpdatePayload = useCallback((): UpdateTreeInput => {
    return {
      categories: categories.map((cat, catIdx) => ({
        ...cat,
        displayOrder: catIdx,
        topics: cat.topics.map((topic, topicIdx) => ({
          ...topic,
          displayOrder: topicIdx,
        })),
      })),
    }
  }, [categories])

  return {
    categories,
    isDirty,
    resetFromApi,
    addCategory,
    updateCategory,
    deleteCategory,
    addTopic,
    updateTopic,
    deleteTopic,
    moveCategory,
    moveTopic,
    getUpdatePayload,
  }
}
