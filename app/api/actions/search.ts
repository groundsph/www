"use server"

import { db } from "@/db"
import { cafes, profiles, blogPosts, cafeCrawls, collections, events, cafeMenuItems } from "@/db/schema"
import { ilike, or, eq, and } from "drizzle-orm"
import { SearchResult } from "@/utils/types/search"
import { staticPages, quickActions } from "@/utils/search-index"
import { omitTestCafes } from "@/utils/filters"

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
      and(or(ilike(cafes.name, searchTerm), ilike(cafes.addressDisplay, searchTerm)), ...omitTestCafes([]))
    ).limit(MAX_RESULTS / 2),

    !query.startsWith('>')
      ? db.select({
          id: profiles.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          isPrivate: profiles.isPrivate,
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
      isPrivate: user.isPrivate ?? undefined,
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

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function searchMenuItems(
  query: string,
  userLat?: number,
  userLng?: number
): Promise<SearchResult[]> {
  if (!query || query.length < 2) return []

  const items = await db
    .select({
      id: cafeMenuItems.id,
      name: cafeMenuItems.name,
      category: cafeMenuItems.category,
      price: cafeMenuItems.price,
      cafeName: cafes.name,
      cafeSlug: cafes.slug,
      cafeLat: cafes.lat,
      cafeLng: cafes.lng,
    })
    .from(cafeMenuItems)
    .innerJoin(cafes, eq(cafeMenuItems.cafeId, cafes.id))
    .where(
      and(
        ilike(cafeMenuItems.name, `%${query}%`),
        eq(cafeMenuItems.isAvailable, true),
        eq(cafes.isPublished, true),
        ...omitTestCafes([])
      )
    )
    .limit(5)

  // Map to include distance for sorting (if location available)
  const results = items.map(item => {
    const distance = userLat !== undefined && userLng !== undefined && item.cafeLat !== null && item.cafeLng !== null
      ? haversineDistance(userLat, userLng, item.cafeLat, item.cafeLng)
      : null
    return {
      id: item.id,
      type: "menu-item" as const,
      title: item.name,
      subtitle: `${item.cafeName} · ${item.category} · ₱${item.price.toFixed(2)}`,
      href: `/cafes/${item.cafeSlug}/menu?item=${item.id}`,
      priority: 60,
      keywords: [item.name, item.category, item.cafeName],
      distance,
    }
  })

  if (userLat !== undefined && userLng !== undefined) {
    results.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0
      if (a.distance === null) return 1
      if (b.distance === null) return -1
      return a.distance - b.distance
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return results.slice(0, 3).map(({ distance, ...rest }) => rest)
}

export async function globalSearch(
  query: string,
  userLat?: number,
  userLng?: number
): Promise<SearchResult[]> {
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

  if (trimmedQuery.startsWith('#')) {
    const menuQuery = trimmedQuery.slice(1).trim()
    if (menuQuery.length >= 2) {
      const menuResults = await searchMenuItems(menuQuery, userLat, userLng)
      return menuResults.map(r => ({ ...r, priority: 1 }))
    }
    return []
  }

  const [dynamicResults, blogResults, crawlResults, collectionResults, eventResults, menuItemResults] = await Promise.all([
    searchCafesAndUsers(trimmedQuery),
    searchBlogs(trimmedQuery),
    searchCrawls(trimmedQuery),
    searchCollections(trimmedQuery),
    searchEvents(trimmedQuery),
    searchMenuItems(trimmedQuery, userLat, userLng),
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
    ...menuItemResults,
  ]

  return allResults.sort((a, b) => b.priority - a.priority).slice(0, MAX_RESULTS)
}
