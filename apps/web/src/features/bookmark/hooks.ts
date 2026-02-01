import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"
import type { BookmarkTargetType } from "./api"

export const useBookmarks = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: api.getBookmarks,
  })

  return {
    bookmarks: data?.bookmarks ?? [],
    isLoading,
    error,
  }
}

export const useToggleBookmark = () => {
  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: BookmarkTargetType; targetId: string }) =>
      api.addBookmark(targetType, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: BookmarkTargetType; targetId: string }) =>
      api.removeBookmark(targetType, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] })
    },
  })

  const toggle = (
    targetType: BookmarkTargetType,
    targetId: string,
    isCurrentlyBookmarked: boolean
  ) => {
    if (isCurrentlyBookmarked) {
      removeMutation.mutate({ targetType, targetId })
    } else {
      addMutation.mutate({ targetType, targetId })
    }
  }

  return {
    toggle,
    isLoading: addMutation.isPending || removeMutation.isPending,
  }
}

export const useIsBookmarked = (
  targetType: BookmarkTargetType,
  targetId: string
) => {
  const { bookmarks, isLoading } = useBookmarks()
  const isBookmarked = api.isBookmarked(bookmarks, targetType, targetId)

  return {
    isBookmarked,
    isLoading,
  }
}
