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
