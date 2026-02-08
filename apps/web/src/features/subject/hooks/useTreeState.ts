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
    subcategories: cat.subcategories.map((sub, subIdx) => ({
      id: sub.id,
      name: sub.name,
      displayOrder: sub.displayOrder ?? subIdx,
      topics: sub.topics.map((topic, topicIdx) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        difficulty: topic.difficulty,
        topicType: topic.topicType,
        aiSystemPrompt: topic.aiSystemPrompt,
        displayOrder: topic.displayOrder ?? topicIdx,
      })),
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
  const addCategory = useCallback((name: string = "新しい単元") => {
    setCategories((prev) => [
      ...prev,
      {
        id: null,
        name,
        displayOrder: prev.length,
        subcategories: [],
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

  // Add subcategory
  const addSubcategory = useCallback(
    (categoryIdx: number, name: string = "新しい中単元") => {
      setCategories((prev) =>
        prev.map((cat, idx) =>
          idx === categoryIdx
            ? {
                ...cat,
                subcategories: [
                  ...cat.subcategories,
                  {
                    id: null,
                    name,
                    displayOrder: cat.subcategories.length,
                    topics: [],
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

  // Update subcategory name
  const updateSubcategory = useCallback(
    (categoryIdx: number, subcategoryIdx: number, name: string) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) =>
          catIdx === categoryIdx
            ? {
                ...cat,
                subcategories: cat.subcategories.map((sub, subIdx) =>
                  subIdx === subcategoryIdx ? { ...sub, name } : sub
                ),
              }
            : cat
        )
      )
      setIsDirty(true)
    },
    []
  )

  // Delete subcategory
  const deleteSubcategory = useCallback(
    (categoryIdx: number, subcategoryIdx: number) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) =>
          catIdx === categoryIdx
            ? {
                ...cat,
                subcategories: cat.subcategories.filter(
                  (_, subIdx) => subIdx !== subcategoryIdx
                ),
              }
            : cat
        )
      )
      setIsDirty(true)
    },
    []
  )

  // Add topic
  const addTopic = useCallback(
    (
      categoryIdx: number,
      subcategoryIdx: number,
      name: string = "新しい論点"
    ) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) =>
          catIdx === categoryIdx
            ? {
                ...cat,
                subcategories: cat.subcategories.map((sub, subIdx) =>
                  subIdx === subcategoryIdx
                    ? {
                        ...sub,
                        topics: [
                          ...sub.topics,
                          {
                            id: null,
                            name,
                            description: null,
                            difficulty: null,
                            topicType: null,
                            aiSystemPrompt: null,
                            displayOrder: sub.topics.length,
                          },
                        ],
                      }
                    : sub
                ),
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
      subcategoryIdx: number,
      topicIdx: number,
      updates: Partial<TopicNodeInput>
    ) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) =>
          catIdx === categoryIdx
            ? {
                ...cat,
                subcategories: cat.subcategories.map((sub, subIdx) =>
                  subIdx === subcategoryIdx
                    ? {
                        ...sub,
                        topics: sub.topics.map((topic, tIdx) =>
                          tIdx === topicIdx ? { ...topic, ...updates } : topic
                        ),
                      }
                    : sub
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
    (categoryIdx: number, subcategoryIdx: number, topicIdx: number) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) =>
          catIdx === categoryIdx
            ? {
                ...cat,
                subcategories: cat.subcategories.map((sub, subIdx) =>
                  subIdx === subcategoryIdx
                    ? {
                        ...sub,
                        topics: sub.topics.filter(
                          (_, tIdx) => tIdx !== topicIdx
                        ),
                      }
                    : sub
                ),
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

  // Move subcategory within same category
  const moveSubcategory = useCallback(
    (categoryIdx: number, fromIdx: number, toIdx: number) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) => {
          if (catIdx !== categoryIdx) return cat
          const newSubs = [...cat.subcategories]
          const [moved] = newSubs.splice(fromIdx, 1)
          newSubs.splice(toIdx, 0, moved)
          return {
            ...cat,
            subcategories: newSubs.map((sub, idx) => ({
              ...sub,
              displayOrder: idx,
            })),
          }
        })
      )
      setIsDirty(true)
    },
    []
  )

  // Move topic within same subcategory
  const moveTopic = useCallback(
    (
      categoryIdx: number,
      subcategoryIdx: number,
      fromIdx: number,
      toIdx: number
    ) => {
      setCategories((prev) =>
        prev.map((cat, catIdx) => {
          if (catIdx !== categoryIdx) return cat
          return {
            ...cat,
            subcategories: cat.subcategories.map((sub, subIdx) => {
              if (subIdx !== subcategoryIdx) return sub
              const newTopics = [...sub.topics]
              const [moved] = newTopics.splice(fromIdx, 1)
              newTopics.splice(toIdx, 0, moved)
              return {
                ...sub,
                topics: newTopics.map((t, idx) => ({ ...t, displayOrder: idx })),
              }
            }),
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
        subcategories: cat.subcategories.map((sub, subIdx) => ({
          ...sub,
          displayOrder: subIdx,
          topics: sub.topics.map((topic, topicIdx) => ({
            ...topic,
            displayOrder: topicIdx,
          })),
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
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    addTopic,
    updateTopic,
    deleteTopic,
    moveCategory,
    moveSubcategory,
    moveTopic,
    getUpdatePayload,
  }
}
