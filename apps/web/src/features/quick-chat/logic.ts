type TopicTree = {
  categories: Array<{
    subcategories: Array<{
      id: string
      topics: Array<{ id: string; name: string }>
    }>
  }>
}

export const findCreatedTopic = (
  tree: TopicTree,
  topicName: string,
  existingTopicIds: ReadonlySet<string>,
  categoryId: string | null
): { topicId: string; categoryId: string } | null => {
  for (const category of tree.categories) {
    for (const subcategory of category.subcategories) {
      if (categoryId && subcategory.id !== categoryId) continue
      const topic = subcategory.topics.find(
        (candidate) =>
          candidate.name === topicName && !existingTopicIds.has(candidate.id)
      )
      if (topic) return { topicId: topic.id, categoryId: subcategory.id }
    }
  }
  return null
}
