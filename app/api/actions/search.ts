"use server"

import { db } from "@/db"
import { cafes, profiles } from "@/db/schema"
import { ilike, or } from "drizzle-orm"
import { SearchResult } from "@/utils/types/search"
import { staticPages, quickActions } from "@/utils/search-index"

const MAX_RESULTS = 8

export async function searchCafesAndUsers(
  query: string
): Promise<SearchResult[]> {
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
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
        }).from(profiles).where(
          or(ilike(profiles.username, searchTerm), ilike(profiles.displayName, searchTerm))
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
