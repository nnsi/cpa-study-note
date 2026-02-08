import { useState, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"
import * as api from "./api"
import { useStudyDomains } from "@/features/study-domain/hooks/useStudyDomains"
import { useDebounce } from "@/lib/hooks/useDebounce"

export const useGlobalSearch = (query: string) => {
  const debouncedQuery = useDebounce(query, 300)

  // URLパラメータから現在のドメインIDを取得
  const params = useParams({ strict: false }) as { domainId?: string }
  const urlDomainId = params.domainId

  // URLにドメインIDがない場合は、最初のドメインを使用
  const { studyDomains } = useStudyDomains()
  const studyDomainId = urlDomainId ?? studyDomains[0]?.id

  const { data, isLoading, error } = useQuery({
    queryKey: ["topics", "search", debouncedQuery, studyDomainId],
    queryFn: () => api.searchTopics(debouncedQuery, studyDomainId, 20),
    enabled: debouncedQuery.length >= 1 && !!studyDomainId,
  })

  return {
    results: data?.results ?? [],
    total: data?.total ?? 0,
    isLoading: query.length >= 1 && isLoading,
    error,
  }
}

export const useSearchModal = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery("")
  }, [])

  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, open, close])

  return {
    isOpen,
    query,
    setQuery,
    open,
    close,
    toggle,
  }
}

export const useSearchNavigation = (
  results: api.TopicSearchResult[],
  onSelect: (result: api.TopicSearchResult) => void
) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (results.length === 0) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % results.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
          break
        case "Enter":
          e.preventDefault()
          if (results[selectedIndex]) {
            onSelect(results[selectedIndex])
          }
          break
      }
    },
    [results, selectedIndex, onSelect]
  )

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  }
}
