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
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["notes", "topic", topicId] })
      queryClient.invalidateQueries({ queryKey: ["notes"] })
      queryClient.invalidateQueries({ queryKey: ["notes", "session", sessionId] })
    },
  })
}

export const useNoteBySession = (sessionId: string | null) => {
  return useQuery({
    queryKey: ["notes", "session", sessionId],
    queryFn: () => api.getNoteBySession(sessionId!),
    enabled: !!sessionId,
  })
}

export const useRefreshNote = (topicId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (noteId: string) => api.refreshNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", "topic", topicId] })
      queryClient.invalidateQueries({ queryKey: ["notes"] })
    },
  })
}
