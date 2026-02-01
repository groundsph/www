"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { SearchInput } from "./SearchInput"
import { SearchResults } from "./SearchResults"
import { SearchEmptyState } from "./SearchEmptyState"
import { useSearch } from "@/utils/hooks/useSearch"
import { SearchResult } from "@/utils/types/search"
import { useRouter } from "next/navigation"

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter()
  const { query, setQuery, results, isLoading } = useSearch(150)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const resetState = () => {
      setQuery("")
      setSelectedIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 100)
    }

    if (isOpen) {
      resetState()
    }
  }, [isOpen, setQuery])

  const handleSelect = useCallback((result: SearchResult) => {
    router.push(result.href)
    onClose()
  }, [router, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault()
          setSelectedIndex(prev => prev < results.length - 1 ? prev + 1 : prev)
          break
        case "ArrowUp":
          event.preventDefault()
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
          break
        case "Enter":
          event.preventDefault()
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelect(results[selectedIndex])
          }
          break
        case "Escape":
          event.preventDefault()
          onClose()
          break
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, results, selectedIndex, handleSelect, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-text/20 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl z-50 px-4"
          >
            <div className="bg-background rounded-2xl shadow-2xl border border-text/10 overflow-hidden">
              <div className="border-b border-text/10">
                <SearchInput
                  ref={inputRef}
                  value={query}
                  onChange={setQuery}
                  isLoading={isLoading}
                  placeholder="Search pages, cafes, users..."
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {query.trim() ? (
                  <SearchResults
                    results={results}
                    selectedIndex={selectedIndex}
                    onSelect={handleSelect}
                    query={query}
                  />
                ) : (
                  <SearchEmptyState />
                )}
              </div>
              <div className="px-4 py-3 border-t border-text/10 bg-text/5 text-xs text-text/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-background rounded border border-text/20 text-[10px]">↑↓</kbd>
                    to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-background rounded border border-text/20 text-[10px]">↵</kbd>
                    to select
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline">
                    <kbd className="px-1.5 py-0.5 bg-background rounded border border-text/20 text-[10px] mr-0.5">@</kbd>
                    for users
                  </span>
                  <span className="hidden sm:inline">
                    <kbd className="px-1.5 py-0.5 bg-background rounded border border-text/20 text-[10px] mr-0.5">&gt;</kbd>
                    for actions
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
