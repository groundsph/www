# Global Search Implementation Plan

## Progress Checklist

- [x] **Phase 1**: Infrastructure & Types
- [x] **Phase 2**: Server Actions & Search Logic
- [x] **Phase 3**: UI Components (Modal, Results, Keyboard)
- [x] **Phase 4**: Integration with Navbar
- [ ] **Phase 5**: Testing & Polish

---

## Overview

A spotlight-style global search accessible via navbar button or `Cmd/Ctrl + K` shortcut. Supports fuzzy search across pages, cafes, and users with quick action prefixes (`>`, `@`).

### Tech Stack
- **Fuzzy Search**: fuse.js
- **Animations**: Framer Motion (motion/react)
- **Styling**: Tailwind CSS v4
- **Icons**: lucide-react
- **Keyboard**: Custom hook with Cmd+K capture

---

## Phase 1: Infrastructure & Types

**Goal**: Set up types, install dependencies, and create base files.

### 1.1 Install Dependencies
```bash
bun add fuse.js
```

### 1.2 Create Types

```typescript
// utils/types/search.ts

export type SearchResultType = 'page' | 'cafe' | 'user' | 'action'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  href: string
  icon?: string
  priority: number // 1-100, higher = shown first
  keywords?: string[] // Additional search terms
}

export interface QuickAction {
  prefix: string
  description: string
  example: string
}
```

### 1.3 Create Static Search Index

```typescript
// utils/search-index.ts

export const staticPages: SearchResult[] = [
  {
    id: 'page-home',
    type: 'page',
    title: 'Home',
    subtitle: 'Featured cafes and recent activity',
    href: '/',
    priority: 90,
    keywords: ['home', 'main', 'start']
  },
  {
    id: 'page-cafes',
    type: 'page',
    title: 'Cafes',
    subtitle: 'Browse all coffee shops',
    href: '/cafes',
    priority: 85,
    keywords: ['coffee', 'shops', 'browse', 'list']
  },
  {
    id: 'page-map',
    type: 'page',
    title: 'Map',
    subtitle: 'Find cafes on the map',
    href: '/map',
    priority: 85,
    keywords: ['location', 'nearby', 'find']
  },
  {
    id: 'page-community',
    type: 'page',
    title: 'Community',
    subtitle: 'Discover and connect',
    href: '/community',
    priority: 80,
    keywords: ['social', 'users', 'discover']
  },
  {
    id: 'page-blog',
    type: 'page',
    title: 'Blog',
    subtitle: 'Articles and updates',
    href: '/blog',
    priority: 75,
    keywords: ['articles', 'news', 'posts']
  },
  {
    id: 'page-submit',
    type: 'page',
    title: 'Submit Cafe',
    subtitle: 'Add a new coffee shop',
    href: '/submit',
    priority: 70,
    keywords: ['add', 'contribute', 'new']
  },
  {
    id: 'page-donate',
    type: 'page',
    title: 'Donate',
    subtitle: 'Support the platform',
    href: '/donate',
    priority: 60,
    keywords: ['support', 'contribute', 'help']
  },
  {
    id: 'page-profile',
    type: 'page',
    title: 'My Profile',
    subtitle: 'View and edit your profile',
    href: '/profile',
    priority: 70,
    keywords: ['account', 'settings', 'me']
  },
]

export const quickActions: SearchResult[] = [
  {
    id: 'action-submit',
    type: 'action',
    title: 'Quick: Submit Cafe',
    subtitle: 'Type ">submit" anywhere',
    href: '/submit',
    priority: 95,
    keywords: ['>submit', 'quick submit']
  },
  {
    id: 'action-map',
    type: 'action',
    title: 'Quick: Open Map',
    subtitle: 'Type ">map" anywhere',
    href: '/map',
    priority: 95,
    keywords: ['>map', 'quick map']
  },
]

export const quickActionHelp: QuickAction[] = [
  { prefix: '>', description: 'Quick actions', example: '>submit, >map' },
  { prefix: '@', description: 'Search users', example: '@username' },
]

export const emptyStateSuggestions: SearchResult[] = [
  {
    id: 'suggest-popular-1',
    type: 'page',
    title: 'Browse Popular Cafes',
    subtitle: 'See what others are visiting',
    href: '/cafes',
    priority: 100
  },
  {
    id: 'suggest-map',
    type: 'page',
    title: 'Explore the Map',
    subtitle: 'Find cafes near you',
    href: '/map',
    priority: 95
  },
  {
    id: 'suggest-submit',
    type: 'page',
    title: 'Submit a Cafe',
    subtitle: 'Add your favorite spot',
    href: '/submit',
    priority: 90
  },
]
```

### Phase 1 Stop & Test
```bash
bun lint
bun build
```

---

## Phase 2: Server Actions & Search Logic

### 2.1 Server Action

```typescript
// app/api/actions/search.ts
"use server"

import { db } from "@/db"
import { cafes, users } from "@/db/schema"
import { ilike, or } from "drizzle-orm"
import { SearchResult } from "@/utils/types/search"
import { staticPages, quickActions } from "@/utils/search-index"

const MAX_RESULTS = 8

export async function searchCafesAndUsers(query: string): Promise<SearchResult[]> {
  if (!query.trim() || query.length < 2) return []

  const searchTerm = `%${query}%`
  
  const [cafeResults, userResults] = await Promise.all([
    db.select({
      id: cafes.id,
      name: cafes.name,
      addressDisplay: cafes.addressDisplay,
      slug: cafes.slug,
    }).from(cafes).where(
      or(ilike(cafes.name, searchTerm), ilike(cafes.addressDisplay, searchTerm))
    ).limit(MAX_RESULTS / 2),
    
    !query.startsWith('>') 
      ? db.select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        }).from(users).where(
          or(ilike(users.username, searchTerm), ilike(users.displayName, searchTerm))
        ).limit(MAX_RESULTS / 2)
      : Promise.resolve([]),
  ])

  return [
    ...cafeResults.map(cafe => ({
      id: `cafe-${cafe.id}`,
      type: 'cafe' as const,
      title: cafe.name,
      subtitle: cafe.addressDisplay,
      href: `/cafes/${cafe.slug}`,
      priority: 80,
    })),
    ...userResults.map(user => ({
      id: `user-${user.id}`,
      type: 'user' as const,
      title: user.displayName || user.username,
      subtitle: `@${user.username}`,
      href: `/profile/${user.username}`,
      priority: 70,
    })),
  ]
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const trimmedQuery = query.trim().toLowerCase()
  if (!trimmedQuery) return []

  if (trimmedQuery.startsWith('>')) {
    const actionQuery = trimmedQuery.slice(1)
    return quickActions.filter(action => 
      action.keywords?.some(k => k.toLowerCase().includes(actionQuery))
    )
  }

  if (trimmedQuery.startsWith('@')) {
    const userQuery = trimmedQuery.slice(1)
    if (userQuery.length < 2) return []
    const results = await searchCafesAndUsers(userQuery)
    return results.filter(r => r.type === 'user')
  }

  const dynamicResults = await searchCafesAndUsers(trimmedQuery)
  const allResults = [
    ...staticPages.filter(page => 
      page.title.toLowerCase().includes(trimmedQuery) ||
      page.subtitle?.toLowerCase().includes(trimmedQuery) ||
      page.keywords?.some(k => k.toLowerCase().includes(trimmedQuery))
    ),
    ...dynamicResults,
  ]

  return allResults.sort((a, b) => b.priority - a.priority).slice(0, MAX_RESULTS)
}
```

### 2.2 Search Hook

```typescript
// utils/hooks/useSearch.ts

import { useState, useEffect, useCallback } from "react"
import { useDebounce } from "./useDebounce"
import { SearchResult } from "@/utils/types/search"
import { globalSearch } from "@/app/api/actions/search"

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
      setResults(searchResults)
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
```

### 2.3 Keyboard Hook

```typescript
// utils/hooks/useSearchKeyboard.ts

import { useEffect, useCallback } from "react"

export function useSearchKeyboard(onOpen: () => void) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
      event.preventDefault()
      onOpen()
    }
  }, [onOpen])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}
```

### 2.4 Search Utils

```typescript
// components/search/search-utils.ts

import Fuse from "fuse.js"
import { SearchResult } from "@/utils/types/search"

const fuseOptions = {
  keys: [
    { name: "title", weight: 0.5 },
    { name: "subtitle", weight: 0.3 },
    { name: "keywords", weight: 0.2 },
  ],
  threshold: 0.4,
  includeScore: true,
  ignoreLocation: true,
}

export function createFuseIndex(items: SearchResult[]) {
  return new Fuse(items, fuseOptions)
}

export function getResultIcon(type: string): string {
  switch (type) {
    case "page": return "FileText"
    case "cafe": return "Coffee"
    case "user": return "User"
    case "action": return "Zap"
    default: return "Search"
  }
}
```

### Phase 2 Stop & Test
```bash
bun lint
bun build
```

---

## Phase 3: UI Components

### 3.1 Search Modal

```typescript
// components/search/SearchModal.tsx
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
    if (isOpen) {
      setQuery("")
      setSelectedIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 100)
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
                    <kbd className="px-1.5 py-0.5 bg-background rounded border border-text/20 text-[10px]">@</kbd>
                    for users
                  </span>
                  <span className="hidden sm:inline">
                    <kbd className="px-1.5 py-0.5 bg-background rounded border border-text/20 text-[10px]">&gt;</kbd>
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
```

### 3.2 Search Input

```typescript
// components/search/SearchInput.tsx
"use client"

import { forwardRef } from "react"
import { Search, Loader2 } from "lucide-react"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  isLoading?: boolean
  placeholder?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, isLoading, placeholder }, ref) => (
    <div className="relative flex items-center px-4 py-4">
      <div className="absolute left-4 text-text/40">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
      </div>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 text-lg bg-transparent outline-none placeholder:text-text/40 text-text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-4 p-1 rounded-full hover:bg-text/10 text-text/40 hover:text-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
)

SearchInput.displayName = "SearchInput"
```

### 3.3 Search Results

```typescript
// components/search/SearchResults.tsx
"use client"

import { motion } from "motion/react"
import { SearchResult } from "@/utils/types/search"
import { getResultIcon } from "./search-utils"
import { FileText, Coffee, User, Zap, CornerDownRight } from "lucide-react"
import { cn } from "@/utils/cn"

interface SearchResultsProps {
  results: SearchResult[]
  selectedIndex: number
  onSelect: (result: SearchResult) => void
  query: string
}

const iconMap = { FileText, Coffee, User, Zap }

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text
  const parts = text.split(new RegExp(`(${query})`, "gi"))
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/20 text-text rounded px-0.5">{part}</mark>
    ) : part
  )
}

export function SearchResults({ results, selectedIndex, onSelect, query }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-text/60">No results found for "{query}"</p>
        <p className="text-text/40 text-sm mt-2">Try a different search term or check your spelling</p>
      </div>
    )
  }

  const grouped = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = []
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  const groupOrder = ['action', 'page', 'cafe', 'user']
  const groupLabels: Record<string, string> = {
    action: 'Quick Actions', page: 'Pages', cafe: 'Cafes', user: 'Users',
  }

  return (
    <div className="py-2">
      {groupOrder.map((type) => {
        const groupResults = grouped[type]
        if (!groupResults?.length) return null

        return (
          <div key={type} className="mb-2 last:mb-0">
            <div className="px-4 py-2 text-xs font-medium text-text/50 uppercase tracking-wider">
              {groupLabels[type]}
            </div>
            {groupResults.map((result) => {
              const globalIndex = results.indexOf(result)
              const isSelected = globalIndex === selectedIndex
              const Icon = iconMap[getResultIcon(result.type) as keyof typeof iconMap] || FileText

              return (
                <motion.button
                  key={result.id}
                  onClick={() => onSelect(result)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                    isSelected ? "bg-primary/10" : "hover:bg-text/5"
                  )}
                  layout
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    type === 'action' && "bg-accent/20 text-accent",
                    type === 'page' && "bg-secondary/20 text-secondary",
                    type === 'cafe' && "bg-primary/20 text-primary",
                    type === 'user' && "bg-tertiary text-text"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">
                      {highlightMatch(result.title, query)}
                    </p>
                    {result.subtitle && (
                      <p className="text-xs text-text/60 truncate">
                        {highlightMatch(result.subtitle, query)}
                      </p>
                    )}
                  </div>
                  {isSelected && <CornerDownRight className="w-4 h-4 text-text/40" />}
                </motion.button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

### 3.4 Empty State (Cycling)

```typescript
// components/search/SearchEmptyState.tsx
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { emptyStateSuggestions, quickActionHelp } from "@/utils/search-index"
import { Sparkles } from "lucide-react"

const suggestions = emptyStateSuggestions

export function SearchEmptyState() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % suggestions.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <p className="text-xs font-medium text-text/50 uppercase tracking-wider mb-3">Featured</p>
        <div className="relative h-16 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.a
              key={currentIndex}
              href={suggestions[currentIndex].href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center gap-3 p-3 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-text">{suggestions[currentIndex].title}</p>
                <p className="text-sm text-text/60">{suggestions[currentIndex].subtitle}</p>
              </div>
            </motion.a>
          </AnimatePresence>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-text/50 uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="space-y-2">
          {quickActionHelp.map((action) => (
            <div key={action.prefix} className="flex items-center justify-between p-3 rounded-xl bg-text/5">
              <div className="flex items-center gap-3">
                <kbd className="px-2 py-1 bg-background rounded-lg border border-text/20 text-sm font-mono text-text">
                  {action.prefix}
                </kbd>
                <span className="text-sm text-text/70">{action.description}</span>
              </div>
              <span className="text-xs text-text/40">{action.example}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium text-text/50 uppercase tracking-wider mb-3">Popular</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Submit Cafe", href: "/submit" },
            { label: "Browse Map", href: "/map" },
            { label: "Community", href: "/community" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 text-sm bg-text/5 hover:bg-text/10 text-text/70 hover:text-text rounded-full transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### 3.5 Search Trigger

```typescript
// components/search/SearchTrigger.tsx
"use client"

import { Search } from "lucide-react"
import { cn } from "@/utils/cn"

interface SearchTriggerProps {
  onClick: () => void
  variant?: "desktop" | "mobile"
  className?: string
}

export function SearchTrigger({ onClick, variant = "desktop", className }: SearchTriggerProps) {
  if (variant === "mobile") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-xl",
          "bg-text/5 hover:bg-text/10 text-text/70 hover:text-text",
          "transition-colors",
          className
        )}
        aria-label="Search"
      >
        <Search className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl",
        "bg-text/5 hover:bg-text/10 text-text/70 hover:text-text",
        "border border-text/10 hover:border-text/20",
        "transition-all duration-200",
        className
      )}
    >
      <Search className="w-4 h-4" />
      <span className="text-sm">Search...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-background rounded border border-text/20 text-text/50 ml-2">
        <span className="text-[8px]">⌘</span>K
      </kbd>
    </button>
  )
}
```

### 3.6 Index Export

```typescript
// components/search/index.ts
export { SearchModal } from "./SearchModal"
export { SearchTrigger } from "./SearchTrigger"
export { SearchResults } from "./SearchResults"
export { SearchEmptyState } from "./SearchEmptyState"
export { SearchInput } from "./SearchInput"
```

### Phase 3 Stop & Test
```bash
bun lint
bun build
```

---

## Phase 4: Integration with Navbar

### Update Navbar

```typescript
// components/navbar.tsx (modifications)

"use client"

// ... existing imports ...
import { SearchModal, SearchTrigger } from "@/components/search"
import { useSearchKeyboard } from "@/utils/hooks/useSearchKeyboard"

export function Navbar() {
  // ... existing state ...
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Register keyboard shortcut globally
  useSearchKeyboard(() => setIsSearchOpen(true))

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-text/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              {/* ... existing logo ... */}
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {/* ... existing nav items ... */}
              
              {/* Search Trigger - Desktop */}
              <div className="ml-4">
                <SearchTrigger onClick={() => setIsSearchOpen(true)} />
              </div>

              {/* ... existing auth buttons ... */}
            </div>

            {/* Mobile: Search + Menu */}
            <div className="flex md:hidden items-center gap-2">
              {/* Search Trigger - Mobile (always visible) */}
              <SearchTrigger variant="mobile" onClick={() => setIsSearchOpen(true)} />
              
              {/* ... existing mobile menu button ... */}
            </div>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {/* ... existing mobile menu ... */}
      </nav>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  )
}
```

### Phase 4 Stop & Test
```bash
bun lint
bun build
```

---

## Phase 5: Testing & Polish

### Manual Testing Checklist

**Desktop:**
- [ ] Click search button opens modal
- [ ] Cmd+K (Mac) opens modal
- [ ] Ctrl+K (Windows/Linux) opens modal
- [ ] Modal has backdrop blur
- [ ] Input focuses automatically
- [ ] 150ms debounce works
- [ ] Arrow keys navigate results
- [ ] Enter selects, Escape closes
- [ ] @ prefix filters to users
- [ ] > prefix shows quick actions
- [ ] Empty state cycles every 3 seconds

**Mobile:**
- [ ] Search icon visible in navbar
- [ ] Modal opens correctly
- [ ] Touch targets adequate (44px min)
- [ ] Results are tappable

### Final Verification
```bash
bun lint
bun build
bun test
```

---

## Success Criteria

- Desktop spotlight modal with backdrop blur
- Cmd/Ctrl+K keyboard shortcut with visual hint
- Mobile search always visible in navbar
- Fuzzy search with Fuse.js
- User search with @ prefix
- Quick actions with > prefix
- Cycling empty state suggestions (3s interval)
- 150ms debounce for performance
- Smooth Framer Motion animations
- Follows project Tailwind styling
- All linting passes
- Build succeeds
