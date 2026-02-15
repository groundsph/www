export type SearchResultType = 'page' | 'cafe' | 'user' | 'action' | 'blog' | 'crawl' | 'collection' | 'event'

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
}

export interface QuickAction {
  prefix: string
  description: string
  example: string
}
