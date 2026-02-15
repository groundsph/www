"use server"

import { db } from "@/db"
import { cafes, profiles, blogPosts, cafeCrawls, collections, events } from "@/db/schema"
import { ilike, or, eq, and } from "drizzle-orm"
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
      thumbnail: cafes.thumbnail,
    }).from(cafes).where(
      or(ilike(cafes.name, searchTerm), ilike(cafes.addressDisplay, searchTerm))
    ).limit(MAX_RESULTS / 2),

    !query.startsWith('>')
      ? db.select({
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
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
      imageUrl: cafe.thumbnail,
      priority: 80,
    })),
    ...userResults.map(user => ({
      id: `user-${user.id}`,
      type: 'user' as const,
      title: user.displayName || user.username,
      subtitle: `@${user.username}`,
      href: `/profile/${user.username}`,
      imageUrl: user.avatarUrl || undefined,
      priority: 70,
    })),
  ]
}

async function searchBlogs(query: string): Promise<SearchResult[]> {
  const searchTerm = `%${query}%`
  const results = await db.select({
    id: blogPosts.id,
    title: blogPosts.title,
    slug: blogPosts.slug,
    excerpt: blogPosts.excerpt,
    coverImage: blogPosts.coverImage,
  }).from(blogPosts).where(
    and(
      eq(blogPosts.status, 'published'),
      or(
        ilike(blogPosts.title, searchTerm),
        ilike(blogPosts.excerpt, searchTerm)
      )
    )
  ).limit(4)

  return results.map(blog => ({
    id: `blog-${blog.id}`,
    type: 'blog' as const,
    title: blog.title,
    subtitle: blog.excerpt || undefined,
    href: `/community?tab=blogs&post=${blog.slug}`,
    imageUrl: blog.coverImage || undefined,
    priority: 65,
  }))
}

async function searchCrawls(query: string): Promise<SearchResult[]> {
  const searchTerm = `%${query}%`
  const results = await db.select({
    id: cafeCrawls.id,
    title: cafeCrawls.title,
    slug: cafeCrawls.slug,
    description: cafeCrawls.description,
    coverImage: cafeCrawls.coverImage,
  }).from(cafeCrawls).where(
    and(
      eq(cafeCrawls.status, 'published'),
      eq(cafeCrawls.isPublic, true),
      or(
        ilike(cafeCrawls.title, searchTerm),
        ilike(cafeCrawls.description, searchTerm)
      )
    )
  ).limit(4)

  return results.map(crawl => ({
    id: `crawl-${crawl.id}`,
    type: 'crawl' as const,
    title: crawl.title,
    subtitle: crawl.description || undefined,
    href: `/community?tab=crawls&crawl=${crawl.slug}`,
    imageUrl: crawl.coverImage || undefined,
    priority: 64,
  }))
}

async function searchCollections(query: string): Promise<SearchResult[]> {
  const searchTerm = `%${query}%`
  const results = await db.select({
    id: collections.id,
    title: collections.title,
    slug: collections.slug,
    description: collections.description,
    coverImage: collections.coverImage,
  }).from(collections).where(
    and(
      eq(collections.isPublic, true),
      or(
        ilike(collections.title, searchTerm),
        ilike(collections.description, searchTerm)
      )
    )
  ).limit(4)

  return results.map(collection => ({
    id: `collection-${collection.id}`,
    type: 'collection' as const,
    title: collection.title,
    subtitle: collection.description || undefined,
    href: `/community?tab=collections&collection=${collection.slug}`,
    imageUrl: collection.coverImage || undefined,
    priority: 63,
  }))
}

async function searchEvents(query: string): Promise<SearchResult[]> {
  const searchTerm = `%${query}%`
  const results = await db.select({
    id: events.id,
    title: events.title,
    description: events.description,
    locationName: events.locationName,
    startDate: events.startDate,
  }).from(events).where(
    and(
      eq(events.status, 'published'),
      or(
        ilike(events.title, searchTerm),
        ilike(events.description, searchTerm),
        ilike(events.locationName, searchTerm)
      )
    )
  ).limit(4)

  return results.map(event => ({
    id: `event-${event.id}`,
    type: 'event' as const,
    title: event.title,
    subtitle: event.locationName || event.description || undefined,
    href: `/community?tab=events`,
    priority: 62,
  }))
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

  const [dynamicResults, blogResults, crawlResults, collectionResults, eventResults] = await Promise.all([
    searchCafesAndUsers(trimmedQuery),
    searchBlogs(trimmedQuery),
    searchCrawls(trimmedQuery),
    searchCollections(trimmedQuery),
    searchEvents(trimmedQuery),
  ])

  const allResults = [
    ...staticPages.filter(page =>
      page.title.toLowerCase().includes(trimmedQuery) ||
      page.subtitle?.toLowerCase().includes(trimmedQuery) ||
      page.keywords?.some(k => k.toLowerCase().includes(trimmedQuery))
    ),
    ...dynamicResults,
    ...blogResults,
    ...crawlResults,
    ...collectionResults,
    ...eventResults,
  ]

  return allResults.sort((a, b) => b.priority - a.priority).slice(0, MAX_RESULTS)
}
