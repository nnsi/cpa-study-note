import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as api from "./api"

export const useNotesByTopic = (topicId: string) => {
  return useQuery({
    queryKey: ["notes", "topic", topicId],
    queryFn: () => api.getNotesByTopic(topicId),
  })
}

export const useCreateNote = (topicId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sessionId: string) => api.createNote(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", "topic", topicId] })
      queryClient.invalidateQueries({ queryKey: ["notes"] })
    },
  })
}
