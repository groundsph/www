import { useState, useEffect, useCallback } from "react"
import { useDebounce } from "./useDebounce"
import { SearchResult } from "@/utils/types/search"
import { globalSearch } from "@/app/api/actions/search"
import { buildChatResult } from "@/components/search/search-utils"

export function useSearch(debounceMs = 150) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, debounceMs)

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const searchResults = await globalSearch(searchQuery)
      const chatResult = buildChatResult(searchQuery)
      setResults(chatResult ? [chatResult, ...searchResults] : searchResults)
    } catch (err) {
      setError("Failed to search")
      console.error("Search error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    performSearch(debouncedQuery)
  }, [debouncedQuery, performSearch])

  return { query, setQuery, results, isLoading, error }
}
