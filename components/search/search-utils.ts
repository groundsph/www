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
    case "chat": return "Sparkles"
    case "page": return "FileText"
    case "cafe": return "Coffee"
    case "user": return "User"
    case "action": return "Zap"
    case "blog": return "FileText"
    case "crawl": return "MapIcon"
    case "collection": return "Layers"
    case "event": return "Calendar"
    default: return "Search"
  }
}

export function buildChatResult(query: string): SearchResult | null {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 2) return null
  if (trimmed.startsWith(">") || trimmed.startsWith("@")) return null

  return {
    id: "chat-ask",
    type: "chat",
    title: "Ask Grounds AI",
    subtitle: `Ask about "${trimmed}"`,
    href: "#",
    priority: 100,
  }
}
