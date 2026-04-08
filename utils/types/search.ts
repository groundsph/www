export type SearchResultType = 'page' | 'cafe' | 'user' | 'action' | 'blog' | 'crawl' | 'collection' | 'event' | 'chat' | 'menu-item'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  href: string
  icon?: string
  imageUrl?: string
  priority: number
  keywords?: string[]
  isPrivate?: boolean
}

export interface QuickAction {
  prefix: string
  description: string
  example: string
}
