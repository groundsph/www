"use client"

import { motion } from "motion/react"
import { SearchResult } from "@/utils/types/search"
import { getResultIcon } from "./search-utils"
import { FileText, Coffee, User, Zap, CornerDownRight, MapIcon, Layers, Calendar, Sparkles, Lock, UtensilsCrossed } from "lucide-react"
import { cn } from "@/utils/cn"
import Image from "next/image"
import { UserAvatar } from "@/components/ui/UserAvatar"

const iconMap = { FileText, Coffee, User, Zap, MapIcon, Layers, Calendar, Sparkles, UtensilsCrossed }

interface SearchResultsProps {
  results: SearchResult[]
  selectedIndex: number
  onSelect: (result: SearchResult) => void
  query: string
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text
  const parts = text.split(new RegExp(`(${query})`, "gi"))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/20 text-text rounded px-0.5">{part}</mark>
    ) : part
  )
}

function ResultIcon({ result }: { result: SearchResult }) {
  if (result.type === 'user') {
    return (
      <UserAvatar
        src={result.imageUrl}
        alt={result.title}
        size={32}
      />
    )
  }

  if (result.imageUrl) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
        <Image
          src={result.imageUrl !== 'placeholder' ? result.imageUrl : 'https://cdn.grounds.ph/cafes/placeholder.jpg'}
          alt={result.title}
          width={32}
          height={32}
          className="w-full h-full object-cover"
          loading='lazy'
        />
      </div>
    )
  }

  const Icon = iconMap[getResultIcon(result.type) as keyof typeof iconMap] || FileText

  return (
    <div className={cn(
      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
      result.type === 'action' && "bg-accent/20 text-accent",
      result.type === 'page' && "bg-secondary/20 text-secondary",
      result.type === 'cafe' && "bg-primary/20 text-primary",
      result.type === 'blog' && "bg-secondary/20 text-secondary",
      result.type === 'crawl' && "bg-primary/20 text-primary",
      result.type === 'collection' && "bg-accent/20 text-accent",
      result.type === 'event' && "bg-tertiary/20 text-tertiary",
      result.type === 'chat' && "bg-primary/20 text-primary",
      result.type === 'menu-item' && "bg-secondary/20 text-secondary"
    )}>
      <Icon className="w-4 h-4" />
    </div>
  )
}

export function SearchResults({ results, selectedIndex, onSelect, query }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-text/60">No results found for &quot;{query}&quot;</p>
        <p className="text-text/40 text-sm mt-2">Try a different search term or check your spelling</p>
      </div>
    )
  }

  const grouped = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = []
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  const groupOrder = ['chat', 'action', 'page', 'cafe', 'user', 'blog', 'crawl', 'collection', 'event', 'menu-item']
  const groupLabels: Record<string, string> = {
    chat: 'Grounds AI', action: 'Quick Actions', page: 'Pages', cafe: 'Cafes', user: 'Users',
    blog: 'Blogs', crawl: 'Crawls', collection: 'Collections', event: 'Events', 'menu-item': 'Menu Items',
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
                  <ResultIcon result={result} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text truncate">
                        {highlightMatch(result.title, query)}
                      </p>
                      {result.type === 'user' && result.isPrivate && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-text/10 text-text/60 rounded">
                          <Lock className="w-2.5 h-2.5" />
                          Private
                        </span>
                      )}
                    </div>
                    {result.subtitle && result.type === 'user' && result.isPrivate ? null : (
                      result.subtitle && (
                        <p className="text-xs text-text/60 truncate">
                          {highlightMatch(result.subtitle, query)}
                        </p>
                      )
                    )}
                  </div>
                  {isSelected && <CornerDownRight className="w-4 h-4 text-text opacity-40" />}
                </motion.button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
