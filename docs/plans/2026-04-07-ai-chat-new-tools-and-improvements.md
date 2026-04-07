# AI Chat: New Tools & System Improvements Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the AI Chat with 8 new tools, add multi-turn conversation memory, deduplicate architecture, enrich the system prompt, and improve the overall intelligence and usefulness of the chat experience.

**Architecture:** Layered approach -- first deduplicate and clean the existing code, then add new tools one-by-one with tests, then upgrade the conversation system with memory, then polish the AI behavior with prompt engineering and smart suggestions.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), motion v12, Tailwind CSS v4, Bun, Drizzle ORM, Zod v4, OpenAI-compatible API

---

## Executive Summary

The AI Chat currently has 7 tools and works well for basic cafe search. However, it has significant untapped potential: the database has rich data (reviews, menus, events, operating hours, blog posts) that the AI cannot access. The conversation system has no memory across turns. Code is duplicated between the legacy and streaming paths.

This plan delivers **20 tasks** across 4 categories:
- **8 new AI tools** that unlock reviews, menus, events, blog posts, operating hours, aggregate stats, hidden gems, and feature-based search
- **4 architecture improvements** -- deduplicate code, enrich system prompt, add multi-turn memory, consolidate tools
- **4 conversation UX improvements** -- suggested prompts, feedback mechanism, content moderation, smart context
- **4 code quality tasks** -- remove legacy path, shared types, tests, final verification

### Severity Legend
- 🔴 **Critical** -- New capability that significantly improves AI usefulness
- 🟡 **Important** -- Architecture/quality improvements
- 🟢 **Enhancement** -- UX polish and nice-to-haves

---

## Current State Summary

**Existing 7 tools:**
1. `query_cafes` -- Search/filter cafes by location, amenities, ratings
2. `get_cafe_by_slug` -- Detailed info for a specific cafe
3. `compare_cafes` -- Side-by-side comparison of two cafes
4. `list_cities` -- All cities with cafe counts
5. `get_nearby_cafes` -- Cafes near coordinates
6. `get_top_rated` -- Top rated cafes in a city
7. `get_grounds_info` -- Static platform info (minimal)

**Key gaps identified:**
- No access to reviews, menu items, events, blog posts, or operating hours
- No multi-turn conversation memory (each message is independent)
- Duplicated tool definitions in `chat-tools.ts` and `chat-stream.ts`
- `get_grounds_info` returns a tiny static object with no real data
- No user feedback loop, no suggested prompts, no content moderation
- Legacy non-streaming path (`chat-tools.ts`) is unused but maintained

**Available DB tables not yet exposed:**
- `reviews` -- User reviews with ratings and comments
- `cafe_menu_items` -- Menu items with prices and categories
- `events` -- Coffee events with dates and locations
- `blog_posts` -- Blog content about cafes
- `cafes.operatingHours` -- JSON with day/open/close/24h data
- `cafes.isHiddenGem` -- Hidden gem flag
- `cafeRatingStats` -- Aggregate rating distributions

---

## Implementation Tasks

### Task 1: Deduplicate Tool Definitions and System Prompt 🟡

**Goal:** Extract shared tool definitions and system prompt into a single source of truth.

**Files:**
- Create: `utils/ai/tool-definitions.ts` (shared tool schemas and system prompt)
- Modify: `utils/ai/chat-stream.ts:56-161` (import from shared)
- Modify: `utils/ai/chat-tools.ts:82-187` (import from shared)

**Step 1: Create `utils/ai/tool-definitions.ts`**

```ts
export const CHAT_SYSTEM_PROMPT = `You are a helpful assistant for Grounds, a coffee discovery platform for the Philippines.

You have access to tools for querying cafe information. When a user asks about cafes, use the appropriate tool.

Available tools:
- query_cafes: Search and filter cafes by location, amenities, ratings, etc.
- get_cafe_by_slug: Get detailed information about a specific cafe by its slug
- compare_cafes: Compare two cafes side by side
- list_cities: List all cities with cafe counts
- get_nearby_cafes: Find cafes near a specific location
- get_top_rated: Get top rated cafes in a city
- get_grounds_info: Return general information about Grounds.ph features and how to use the platform
- get_cafe_reviews: Get recent reviews for a specific cafe
- get_cafe_menu: Get the menu for a specific cafe
- get_cafe_hours: Check if a cafe is currently open and its operating schedule
- search_blog_posts: Search blog posts about cafes and coffee
- get_upcoming_events: Get upcoming coffee events
- get_cafe_stats: Get aggregate statistics about cafes
- find_hidden_gems: Discover hidden gem cafes
- find_cafes_with_feature: Find cafes that have a specific combination of features

Rules:
1. Always use tools when the user asks for specific cafe information
2. If a location is mentioned (e.g., "Cebu", "Manila"), use query_cafes with the city filter
3. If the user asks for "top" or "best" cafes, use get_top_rated or sort by rating
4. If the user asks for cafes "near" a location, use get_nearby_cafes
5. Use get_grounds_info for questions about Grounds.ph platform, features, or how to use the site
6. Use get_cafe_reviews when a user asks about reviews, ratings, or what people say about a cafe
7. Use get_cafe_menu when a user asks about food, drinks, prices, or what's available
8. Use get_cafe_hours when a user asks about opening times, closing times, or if a cafe is open
9. Use search_blog_posts when the user asks about articles, stories, or blog content
10. Use get_upcoming_events when the user asks about events, meetups, or happenings
11. Use find_hidden_gems when the user asks for "hidden gems", "undiscovered", "off the beaten path"
12. Use find_cafes_with_feature when the user asks for specific combinations of amenities
13. Ask clarifying questions if day/time or start location is missing for crawl requests
14. Provide concise, helpful responses based on the tool results
15. If no cafes match the query, politely inform the user
16. When you have enough data, respond with a final answer and do not call more tools.
17. If the user refers to the previous list or says things like "from those" or "make a crawl from these", use the recent context rather than calling tools again.
18. If you render tables, use proper Markdown tables with each row on its own line. If you cannot format a table, use bullet points instead.`

interface ToolParameter {
    type: string
    description?: string
    enum?: string[]
    items?: object
}

interface ToolDefinition {
    type: "function"
    function: {
        name: string
        description: string
        parameters: {
            type: "object"
            properties: Record<string, ToolParameter>
            required?: string[]
        }
    }
}

export const CHAT_TOOLS: ToolDefinition[] = [
    {
        type: "function",
        function: {
            name: "query_cafes",
            description: "Search and filter cafes by location, amenities, ratings, and other criteria",
            parameters: {
                type: "object",
                properties: {
                    city: { type: "string", description: "City or municipality name" },
                    province: { type: "string", description: "Province name" },
                    region: { type: "string", description: "Region name" },
                    area: { type: "string", description: "Area or neighborhood" },
                    limit: { type: "number", description: "Maximum number of results (max 50)" },
                    offset: { type: "number", description: "Offset for pagination" },
                    sortBy: { type: "string", enum: ["rating", "distance", "recent", "reviews"], description: "Sort order" },
                    hasWifi: { type: "boolean", description: "Filter for cafes with WiFi" },
                    hasSockets: { type: "boolean", description: "Filter for cafes with power sockets" },
                    hasAircon: { type: "boolean", description: "Filter for cafes with air conditioning" },
                    isPetFriendly: { type: "boolean", description: "Filter for pet-friendly cafes" },
                    isWorkFriendly: { type: "boolean", description: "Filter for work-friendly cafes" },
                    servesFood: { type: "boolean", description: "Filter for cafes that serve food" },
                    hasOutdoorSeating: { type: "boolean", description: "Filter for cafes with outdoor seating" },
                    priceLevel: { type: "string", enum: ["low", "medium", "high"], description: "Price level filter" },
                    coffeeStyle: { type: "string", enum: ["classic", "artisan"], description: "Coffee style filter" },
                },
            },
        },
    },
    // ... (include all 7 existing tools) ...
    // ... (include all 8 new tools defined below) ...
]
```

**Step 2: Update `chat-stream.ts` to import from shared**

Replace the local `tools` array and `CHAT_SYSTEM_PROMPT` with imports:

```ts
import { CHAT_TOOLS, CHAT_SYSTEM_PROMPT } from "@/utils/ai/tool-definitions"
// Remove: const tools: ToolDefinition[] = [...]
// Remove: const CHAT_SYSTEM_PROMPT = `...`
// Use: CHAT_TOOLS instead of tools
```

**Step 3: Update `chat-tools.ts` to import from shared**

Same pattern -- replace local definitions with imports.

**Step 4: Run lint and tests**

```bash
bun lint
bun test utils/ai/__tests__/
```

**Step 5: Commit**

```bash
git add utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts
git commit -m "refactor(chat): extract shared tool definitions and system prompt"
```

---

### Task 2: Add `get_cafe_reviews` Tool 🔴

**Goal:** Let users ask "what do people say about X cafe?" and get actual review data.

**Files:**
- Create: `utils/ai/tools/cafe-reviews.ts` (DB query function)
- Modify: `utils/ai/tool-definitions.ts` (add tool definition)
- Modify: `utils/ai/chat-stream.ts` (add to executeTool switch)
- Modify: `utils/ai/chat-tools.ts` (add to executeTool switch)
- Create: `utils/ai/__tests__/cafe-reviews.test.ts`

**Step 1: Write the failing test**

```ts
// utils/ai/__tests__/cafe-reviews.test.ts
import { describe, it, expect } from "bun:test"

describe("getCafeReviews", () => {
    it("exports a getCafeReviews function", async () => {
        const mod = await import("@/utils/ai/tools/cafe-reviews")
        expect(typeof mod.getCafeReviews).toBe("function")
    })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test utils/ai/__tests__/cafe-reviews.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Create `utils/ai/tools/cafe-reviews.ts`**

```ts
import { db } from "@/db"
import { reviews, profiles } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"

export interface CafeReview {
    id: string
    rating: number
    comment: string
    images: string[] | null
    isVerifiedVisit: boolean
    likesCount: number
    createdAt: string
    author: {
        username: string
        displayName: string
        avatarUrl: string | null
    }
}

export interface CafeReviewsResult {
    cafeId: string
    reviews: CafeReview[]
    totalReviews: number
    averageRating: number | null
}

export async function getCafeReviews(
    cafeSlug: string,
    limit: number = 5
): Promise<CafeReviewsResult | { error: string }> {
    try {
        const { cafes, cafeRatingStats } = await import("@/db/schema")

        const cafe = await db
            .select({ id: cafes.id })
            .from(cafes)
            .where(eq(cafes.slug, cafeSlug))
            .limit(1)

        if (!cafe[0]) {
            return { error: `Cafe with slug "${cafeSlug}" not found` }
        }

        const [reviewResults, statsResult] = await Promise.all([
            db
                .select({
                    id: reviews.id,
                    rating: reviews.rating,
                    comment: reviews.comment,
                    images: reviews.images,
                    isVerifiedVisit: reviews.isVerifiedVisit,
                    likesCount: reviews.likesCount,
                    createdAt: reviews.createdAt,
                    username: profiles.username,
                    displayName: profiles.displayName,
                    avatarUrl: profiles.avatarUrl,
                })
                .from(reviews)
                .innerJoin(profiles, eq(reviews.userId, profiles.id))
                .where(
                    and(
                        eq(reviews.cafeId, cafe[0].id),
                        eq(reviews.status, "published")
                    )
                )
                .orderBy(desc(reviews.createdAt))
                .limit(limit),
            db
                .select({
                    averageRating: cafeRatingStats.averageRating,
                    totalReviews: cafeRatingStats.totalReviews,
                })
                .from(cafeRatingStats)
                .where(eq(cafeRatingStats.cafeId, cafe[0].id))
                .limit(1),
        ])

        return {
            cafeId: cafe[0].id,
            reviews: reviewResults.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                images: r.images,
                isVerifiedVisit: r.isVerifiedVisit ?? false,
                likesCount: r.likesCount ?? 0,
                createdAt: r.createdAt?.toISOString() ?? "",
                author: {
                    username: r.username,
                    displayName: r.displayName,
                    avatarUrl: r.avatarUrl,
                },
            })),
            totalReviews: statsResult[0]?.totalReviews ?? 0,
            averageRating: statsResult[0]?.averageRating ?? null,
        }
    } catch (error) {
        console.error("getCafeReviews error:", error)
        return { error: "Failed to fetch cafe reviews" }
    }
}
```

**Step 4: Add tool definition to `tool-definitions.ts`**

Add to the `CHAT_TOOLS` array:

```ts
{
    type: "function",
    function: {
        name: "get_cafe_reviews",
        description: "Get recent reviews for a specific cafe. Returns the latest reviews with ratings, comments, and author info.",
        parameters: {
            type: "object",
            properties: {
                slug: { type: "string", description: "The cafe's unique slug identifier" },
                limit: { type: "number", description: "Number of reviews to return (default 5, max 20)" },
            },
            required: ["slug"],
        },
    },
},
```

**Step 5: Add to `executeTool` in both `chat-stream.ts` and `chat-tools.ts`**

```ts
case "get_cafe_reviews": {
    const { getCafeReviews } = await import("@/utils/ai/tools/cafe-reviews")
    return await getCafeReviews(parsed.slug as string, parsed.limit ?? 5)
}
```

**Step 6: Run test to verify it passes**

```bash
bun test utils/ai/__tests__/cafe-reviews.test.ts
```

**Step 7: Run lint**

```bash
bun lint
```

**Step 8: Commit**

```bash
git add utils/ai/tools/cafe-reviews.ts utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/cafe-reviews.test.ts
git commit -m "feat(chat): add get_cafe_reviews tool for fetching cafe reviews"
```

---

### Task 3: Add `get_cafe_menu` Tool 🔴

**Goal:** Let users ask "what's on the menu at X cafe?" and get actual menu data with prices.

**Files:**
- Create: `utils/ai/tools/cafe-menu.ts`
- Modify: `utils/ai/tool-definitions.ts` (add tool definition)
- Modify: `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts` (add to executeTool)
- Create: `utils/ai/__tests__/cafe-menu.test.ts`

**Step 1: Write the failing test**

```ts
// utils/ai/__tests__/cafe-menu.test.ts
import { describe, it, expect } from "bun:test"

describe("getCafeMenu", () => {
    it("exports a getCafeMenu function", async () => {
        const mod = await import("@/utils/ai/tools/cafe-menu")
        expect(typeof mod.getCafeMenu).toBe("function")
    })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test utils/ai/__tests__/cafe-menu.test.ts
```

**Step 3: Create `utils/ai/tools/cafe-menu.ts`**

```ts
import { db } from "@/db"
import { cafes, cafeMenuItems } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"

export interface MenuItem {
    id: string
    name: string
    description: string | null
    category: string
    price: number
    imageUrl: string | null
    isAvailable: boolean
    isSignature: boolean
}

export interface CafeMenuResult {
    cafeName: string
    cafeSlug: string
    items: MenuItem[]
    totalItems: number
    categories: string[]
}

export async function getCafeMenu(
    cafeSlug: string,
    category?: string
): Promise<CafeMenuResult | { error: string }> {
    try {
        const cafe = await db
            .select({ id: cafes.id, name: cafes.name, slug: cafes.slug })
            .from(cafes)
            .where(eq(cafes.slug, cafeSlug))
            .limit(1)

        if (!cafe[0]) {
            return { error: `Cafe with slug "${cafeSlug}" not found` }
        }

        const conditions = [eq(cafeMenuItems.cafeId, cafe[0].id)]
        if (category) {
            conditions.push(eq(cafeMenuItems.category, category))
        }

        const items = await db
            .select({
                id: cafeMenuItems.id,
                name: cafeMenuItems.name,
                description: cafeMenuItems.description,
                category: cafeMenuItems.category,
                price: cafeMenuItems.price,
                imageUrl: cafeMenuItems.imageUrl,
                isAvailable: cafeMenuItems.isAvailable,
                isSignature: cafeMenuItems.isSignature,
            })
            .from(cafeMenuItems)
            .where(and(...conditions))
            .orderBy(asc(cafeMenuItems.sortOrder), asc(cafeMenuItems.name))

        const categories = [...new Set(items.map((i) => i.category))]

        return {
            cafeName: cafe[0].name,
            cafeSlug: cafe[0].slug,
            items: items.map((i) => ({
                ...i,
                isAvailable: i.isAvailable ?? true,
                isSignature: i.isSignature ?? false,
            })),
            totalItems: items.length,
            categories,
        }
    } catch (error) {
        console.error("getCafeMenu error:", error)
        return { error: "Failed to fetch cafe menu" }
    }
}
```

**Step 4: Add tool definition to `tool-definitions.ts`**

```ts
{
    type: "function",
    function: {
        name: "get_cafe_menu",
        description: "Get the menu for a specific cafe. Returns items with names, descriptions, categories, and prices.",
        parameters: {
            type: "object",
            properties: {
                slug: { type: "string", description: "The cafe's unique slug identifier" },
                category: { type: "string", description: "Filter by menu category (e.g., 'Coffee', 'Pastry', 'Food')" },
            },
            required: ["slug"],
        },
    },
},
```

**Step 5: Add to `executeTool` in both streaming files**

```ts
case "get_cafe_menu": {
    const { getCafeMenu } = await import("@/utils/ai/tools/cafe-menu")
    return await getCafeMenu(parsed.slug as string, parsed.category)
}
```

**Step 6: Run tests and lint**

```bash
bun test utils/ai/__tests__/cafe-menu.test.ts
bun lint
```

**Step 7: Commit**

```bash
git add utils/ai/tools/cafe-menu.ts utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/cafe-menu.test.ts
git commit -m "feat(chat): add get_cafe_menu tool for fetching menu items and prices"
```

---

### Task 4: Add `get_cafe_hours` Tool 🔴

**Goal:** Let users ask "is X cafe open right now?" or "what are the hours for X?" and get actual operating schedule data.

**Files:**
- Create: `utils/ai/tools/cafe-hours.ts`
- Modify: `utils/ai/tool-definitions.ts`
- Modify: `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts`
- Create: `utils/ai/__tests__/cafe-hours.test.ts`

**Step 1: Write the failing test**

```ts
// utils/ai/__tests__/cafe-hours.test.ts
import { describe, it, expect } from "bun:test"

describe("getCafeHours", () => {
    it("exports a getCafeHours function", async () => {
        const mod = await import("@/utils/ai/tools/cafe-hours")
        expect(typeof mod.getCafeHours).toBe("function")
    })

    it("returns error for unknown slug", async () => {
        const { getCafeHours } = await import("@/utils/ai/tools/cafe-hours")
        const result = await getCafeHours("nonexistent-cafe-xyz-12345")
        expect(result).toHaveProperty("error")
    })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test utils/ai/__tests__/cafe-hours.test.ts
```

**Step 3: Create `utils/ai/tools/cafe-hours.ts`**

```ts
import { db } from "@/db"
import { cafes } from "@/db/schema"
import { eq } from "drizzle-orm"

interface DayHours {
    day: string
    open: string
    close: string
    is_24_hours: boolean
}

export interface CafeHoursResult {
    cafeName: string
    cafeSlug: string
    operatingHours: DayHours[]
    isCurrentlyOpen: boolean | null
    currentTimeInPH: string
    todayHours: DayHours | null
}

function isCurrentlyOpen(hours: DayHours[]): boolean | null {
    try {
        const now = new Date()
        const phTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const todayName = dayNames[phTime.getDay()]

        const todaySchedule = hours.find(
            (h) => h.day.toLowerCase() === todayName.toLowerCase()
        )

        if (!todaySchedule) return null
        if (todaySchedule.is_24_hours) return true

        const currentMinutes = phTime.getHours() * 60 + phTime.getMinutes()
        const [openH, openM] = todaySchedule.open.split(":").map(Number)
        const [closeH, closeM] = todaySchedule.close.split(":").map(Number)
        const openMinutes = openH * 60 + openM
        const closeMinutes = closeH * 60 + closeM

        if (closeMinutes > openMinutes) {
            return currentMinutes >= openMinutes && currentMinutes < closeMinutes
        } else {
            // Handles overnight hours (e.g., 20:00 - 02:00)
            return currentMinutes >= openMinutes || currentMinutes < closeMinutes
        }
    } catch {
        return null
    }
}

export async function getCafeHours(
    cafeSlug: string
): Promise<CafeHoursResult | { error: string }> {
    try {
        const result = await db
            .select({
                name: cafes.name,
                slug: cafes.slug,
                operatingHours: cafes.operatingHours,
            })
            .from(cafes)
            .where(eq(cafes.slug, cafeSlug))
            .limit(1)

        if (!result[0]) {
            return { error: `Cafe with slug "${cafeSlug}" not found` }
        }

        const hours = (result[0].operatingHours ?? []) as DayHours[]
        const phTime = new Date().toLocaleString("en-US", {
            timeZone: "Asia/Manila",
            weekday: "long",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        })

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const now = new Date()
        const phDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
        const todayName = dayNames[phDate.getDay()]
        const todayHours = hours.find((h) => h.day.toLowerCase() === todayName.toLowerCase()) ?? null

        return {
            cafeName: result[0].name,
            cafeSlug: result[0].slug,
            operatingHours: hours,
            isCurrentlyOpen: isCurrentlyOpen(hours),
            currentTimeInPH: phTime,
            todayHours,
        }
    } catch (error) {
        console.error("getCafeHours error:", error)
        return { error: "Failed to fetch cafe hours" }
    }
}
```

**Step 4: Add tool definition, executeTool case, run tests, commit**

```ts
// Tool definition for tool-definitions.ts
{
    type: "function",
    function: {
        name: "get_cafe_hours",
        description: "Check a cafe's operating hours and whether it's currently open. Returns the full weekly schedule and current open/closed status.",
        parameters: {
            type: "object",
            properties: {
                slug: { type: "string", description: "The cafe's unique slug identifier" },
            },
            required: ["slug"],
        },
    },
},
```

```ts
// executeTool case for both streaming files
case "get_cafe_hours": {
    const { getCafeHours } = await import("@/utils/ai/tools/cafe-hours")
    return await getCafeHours(parsed.slug as string)
}
```

**Step 5: Run tests and lint**

```bash
bun test utils/ai/__tests__/cafe-hours.test.ts
bun lint
```

**Step 6: Commit**

```bash
git add utils/ai/tools/cafe-hours.ts utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/cafe-hours.test.ts
git commit -m "feat(chat): add get_cafe_hours tool with open/closed status"
```

---

### Task 5: Add `search_blog_posts` Tool 🔴

**Goal:** Let users ask about articles, stories, or blog content related to cafes.

**Files:**
- Create: `utils/ai/tools/blog-search.ts`
- Modify: `utils/ai/tool-definitions.ts`
- Modify: `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts`
- Create: `utils/ai/__tests__/blog-search.test.ts`

**Step 1: Write the failing test**

```ts
// utils/ai/__tests__/blog-search.test.ts
import { describe, it, expect } from "bun:test"

describe("searchBlogPosts", () => {
    it("exports a searchBlogPosts function", async () => {
        const mod = await import("@/utils/ai/tools/blog-search")
        expect(typeof mod.searchBlogPosts).toBe("function")
    })
})
```

**Step 2: Create `utils/ai/tools/blog-search.ts`**

```ts
import { db } from "@/db"
import { blogPosts, profiles } from "@/db/schema"
import { eq, and, or, ilike, desc } from "drizzle-orm"

export interface BlogPostResult {
    id: string
    title: string
    slug: string
    excerpt: string | null
    category: string
    coverImage: string | null
    tags: string[] | null
    viewsCount: number
    publishedAt: string | null
    author: {
        displayName: string
    }
}

export interface BlogSearchResult {
    posts: BlogPostResult[]
    total: number
    query: string
}

export async function searchBlogPosts(
    query: string,
    limit: number = 5
): Promise<BlogSearchResult | { error: string }> {
    try {
        const results = await db
            .select({
                id: blogPosts.id,
                title: blogPosts.title,
                slug: blogPosts.slug,
                excerpt: blogPosts.excerpt,
                category: blogPosts.category,
                coverImage: blogPosts.coverImage,
                tags: blogPosts.tags,
                viewsCount: blogPosts.viewsCount,
                publishedAt: blogPosts.publishedAt,
                authorName: profiles.displayName,
            })
            .from(blogPosts)
            .innerJoin(profiles, eq(blogPosts.authorId, profiles.id))
            .where(
                and(
                    eq(blogPosts.status, "published"),
                    or(
                        ilike(blogPosts.title, `%${query}%`),
                        ilike(blogPosts.excerpt ?? "", `%${query}%`),
                        ilike(blogPosts.content, `%${query}%`)
                    )
                )
            )
            .orderBy(desc(blogPosts.publishedAt))
            .limit(limit)

        return {
            posts: results.map((r) => ({
                id: r.id,
                title: r.title,
                slug: r.slug,
                excerpt: r.excerpt,
                category: r.category ?? "news",
                coverImage: r.coverImage,
                tags: r.tags,
                viewsCount: r.viewsCount ?? 0,
                publishedAt: r.publishedAt?.toISOString() ?? null,
                author: { displayName: r.authorName },
            })),
            total: results.length,
            query,
        }
    } catch (error) {
        console.error("searchBlogPosts error:", error)
        return { error: "Failed to search blog posts" }
    }
}
```

**Step 3: Add tool definition**

```ts
{
    type: "function",
    function: {
        name: "search_blog_posts",
        description: "Search blog posts about cafes, coffee, and the Philippine coffee scene. Returns articles with titles, excerpts, and metadata.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query for blog posts" },
                limit: { type: "number", description: "Number of results to return (default 5, max 20)" },
            },
            required: ["query"],
        },
    },
},
```

**Step 4: Add to executeTool, run tests, lint, commit**

```bash
bun test utils/ai/__tests__/blog-search.test.ts
bun lint
```

```bash
git add utils/ai/tools/blog-search.ts utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/blog-search.test.ts
git commit -m "feat(chat): add search_blog_posts tool for blog content discovery"
```

---

### Task 6: Add `get_upcoming_events` Tool 🔴

**Goal:** Let users ask "any coffee events coming up?" and get actual event data.

**Files:**
- Create: `utils/ai/tools/events.ts`
- Modify: `utils/ai/tool-definitions.ts`
- Modify: `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts`
- Create: `utils/ai/__tests__/events.test.ts`

**Step 1: Write the failing test**

```ts
// utils/ai/__tests__/events.test.ts
import { describe, it, expect } from "bun:test"

describe("getUpcomingEvents", () => {
    it("exports a getUpcomingEvents function", async () => {
        const mod = await import("@/utils/ai/tools/events")
        expect(typeof mod.getUpcomingEvents).toBe("function")
    })
})
```

**Step 2: Create `utils/ai/tools/events.ts`**

```ts
import { db } from "@/db"
import { events, cafes } from "@/db/schema"
import { eq, and, gte, asc } from "drizzle-orm"

export interface EventResult {
    id: string
    title: string
    description: string | null
    imageUrl: string | null
    startDate: string
    endDate: string | null
    locationName: string | null
    city: string | null
    province: string | null
    ticketLink: string | null
    isNational: boolean
    cafeName: string | null
}

export interface EventsResult {
    events: EventResult[]
    total: number
}

export async function getUpcomingEvents(
    city?: string,
    limit: number = 10
): Promise<EventsResult | { error: string }> {
    try {
        const now = new Date()

        let query = db
            .select({
                id: events.id,
                title: events.title,
                description: events.description,
                imageUrl: events.imageUrl,
                startDate: events.startDate,
                endDate: events.endDate,
                locationName: events.locationName,
                city: events.city,
                province: events.province,
                ticketLink: events.ticketLink,
                isNational: events.isNational,
                cafeName: cafes.name,
            })
            .from(events)
            .leftJoin(cafes, eq(events.cafeId, cafes.id))
            .where(
                and(
                    eq(events.status, "published"),
                    gte(events.startDate, now)
                )
            )
            .orderBy(asc(events.startDate))
            .limit(limit)

        if (city) {
            query = db
                .select({
                    id: events.id,
                    title: events.title,
                    description: events.description,
                    imageUrl: events.imageUrl,
                    startDate: events.startDate,
                    endDate: events.endDate,
                    locationName: events.locationName,
                    city: events.city,
                    province: events.province,
                    ticketLink: events.ticketLink,
                    isNational: events.isNational,
                    cafeName: cafes.name,
                })
                .from(events)
                .leftJoin(cafes, eq(events.cafeId, cafes.id))
                .where(
                    and(
                        eq(events.status, "published"),
                        gte(events.startDate, now),
                        eq(events.isNational, true)
                    )
                )
                .orderBy(asc(events.startDate))
                .limit(limit) as typeof query
        }

        const results = await query

        return {
            events: results.map((r) => ({
                id: r.id,
                title: r.title,
                description: r.description,
                imageUrl: r.imageUrl,
                startDate: r.startDate?.toISOString() ?? "",
                endDate: r.endDate?.toISOString() ?? null,
                locationName: r.locationName,
                city: r.city,
                province: r.province,
                ticketLink: r.ticketLink,
                isNational: r.isNational ?? false,
                cafeName: r.cafeName,
            })),
            total: results.length,
        }
    } catch (error) {
        console.error("getUpcomingEvents error:", error)
        return { error: "Failed to fetch upcoming events" }
    }
}
```

**Step 3: Add tool definition**

```ts
{
    type: "function",
    function: {
        name: "get_upcoming_events",
        description: "Get upcoming coffee events, meetups, and happenings. Can filter by city.",
        parameters: {
            type: "object",
            properties: {
                city: { type: "string", description: "Filter events by city (optional)" },
                limit: { type: "number", description: "Number of events to return (default 10)" },
            },
        },
    },
},
```

**Step 4: Add to executeTool, run tests, lint, commit**

```bash
git add utils/ai/tools/events.ts utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/events.test.ts
git commit -m "feat(chat): add get_upcoming_events tool for event discovery"
```

---

### Task 7: Add `find_hidden_gems` Tool 🔴

**Goal:** Let users ask "any hidden gems in Cebu?" and get cafes flagged as hidden gems.

**Files:**
- Create: `utils/ai/tools/hidden-gems.ts`
- Modify: `utils/ai/tool-definitions.ts`
- Modify: `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts`
- Create: `utils/ai/__tests__/hidden-gems.test.ts`

**Step 1: Create `utils/ai/tools/hidden-gems.ts`**

```ts
import { db } from "@/db"
import { cafes, cafeRatingStats } from "@/db/schema"
import { eq, and, desc, ilike } from "drizzle-orm"

export interface HiddenGemResult {
    id: string
    name: string
    slug: string
    thumbnail: string
    cityMunicipality: string
    province: string
    area: string | null
    description: string | null
    averageRating: number | null
    totalReviews: number | null
    findingHint: string | null
}

export async function findHiddenGems(
    city?: string,
    limit: number = 10
): Promise<{ gems: HiddenGemResult[]; total: number } | { error: string }> {
    try {
        const conditions = [
            eq(cafes.isPublished, true),
            eq(cafes.isHiddenGem, true),
        ]

        if (city) {
            conditions.push(ilike(cafes.cityMunicipality, `%${city}%`))
        }

        const results = await db
            .select({
                id: cafes.id,
                name: cafes.name,
                slug: cafes.slug,
                thumbnail: cafes.thumbnail,
                cityMunicipality: cafes.cityMunicipality,
                province: cafes.province,
                area: cafes.area,
                description: cafes.description,
                averageRating: cafeRatingStats.averageRating,
                totalReviews: cafeRatingStats.totalReviews,
                findingHint: cafes.findingHint,
            })
            .from(cafes)
            .leftJoin(cafeRatingStats, eq(cafes.id, cafeRatingStats.cafeId))
            .where(and(...conditions))
            .orderBy(desc(cafeRatingStats.averageRating))
            .limit(limit)

        return {
            gems: results.map((r) => ({
                ...r,
                averageRating: r.averageRating ?? null,
                totalReviews: r.totalReviews ?? null,
            })),
            total: results.length,
        }
    } catch (error) {
        console.error("findHiddenGems error:", error)
        return { error: "Failed to find hidden gems" }
    }
}
```

**Step 2: Add tool definition**

```ts
{
    type: "function",
    function: {
        name: "find_hidden_gems",
        description: "Discover hidden gem cafes -- lesser-known spots that are highly rated. Can filter by city.",
        parameters: {
            type: "object",
            properties: {
                city: { type: "string", description: "Filter hidden gems by city (optional)" },
                limit: { type: "number", description: "Number of results (default 10)" },
            },
        },
    },
},
```

**Step 3: Add to executeTool, run tests, lint, commit**

```bash
git add utils/ai/tools/hidden-gems.ts utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/hidden-gems.test.ts
git commit -m "feat(chat): add find_hidden_gems tool for discovering lesser-known cafes"
```

---

### Task 8: Add `find_cafes_with_feature` Tool 🔴

**Goal:** Let users ask complex amenity combinations like "cafes with wifi, sockets, and aircon in Makati" in a single natural-language-friendly tool.

**Files:**
- Create: `utils/ai/tools/feature-search.ts`
- Modify: `utils/ai/tool-definitions.ts`
- Modify: `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts`
- Create: `utils/ai/__tests__/feature-search.test.ts`

**Step 1: Create `utils/ai/tools/feature-search.ts`**

```ts
import { runCafeQuery } from "@/utils/ai/tools/cafe-query-runner"
import type { CafeQueryInput } from "@/utils/ai/tools/cafe-query"

export interface FeatureSearchResult {
    query: string
    cafes: unknown[]
    total: number
    appliedFeatures: string[]
}

export async function findCafesWithFeature(params: {
    city?: string
    province?: string
    features: string[]
    limit?: number
}): Promise<FeatureSearchResult | { error: string }> {
    try {
        const featureMap: Record<string, Partial<CafeQueryInput>> = {
            wifi: { hasWifi: true },
            sockets: { hasSockets: true },
            aircon: { hasAircon: true },
            "pet friendly": { isPetFriendly: true },
            "work friendly": { isWorkFriendly: true },
            food: { servesFood: true },
            outdoor: { hasOutdoorSeating: true },
            parking: { hasParking: true },
            halal: { isHalalCertified: true },
            decaf: { hasDecaf: true },
            "non-dairy": { hasNonDairy: true },
        }

        const queryInput: CafeQueryInput = {
            city: params.city,
            province: params.province,
            limit: params.limit ?? 20,
        }

        const appliedFeatures: string[] = []

        for (const feature of params.features) {
            const normalized = feature.toLowerCase().trim()
            if (featureMap[normalized]) {
                Object.assign(queryInput, featureMap[normalized])
                appliedFeatures.push(normalized)
            }
        }

        if (appliedFeatures.length === 0) {
            return { error: `Unknown features: ${params.features.join(", ")}. Available: ${Object.keys(featureMap).join(", ")}` }
        }

        const result = await runCafeQuery(queryInput)

        if ("error" in result) {
            return { error: result.error }
        }

        return {
            query: `Cafes with ${appliedFeatures.join(" + ")}${params.city ? ` in ${params.city}` : ""}`,
            cafes: result.cafes,
            total: result.total,
            appliedFeatures,
        }
    } catch (error) {
        console.error("findCafesWithFeature error:", error)
        return { error: "Failed to search cafes by features" }
    }
}
```

**Step 2: Add tool definition**

```ts
{
    type: "function",
    function: {
        name: "find_cafes_with_feature",
        description: "Find cafes that have a specific combination of features/amenities. Use when the user asks for multiple amenity requirements at once.",
        parameters: {
            type: "object",
            properties: {
                city: { type: "string", description: "City to search in (optional)" },
                province: { type: "string", description: "Province to search in (optional)" },
                features: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of features to search for. Available: wifi, sockets, aircon, pet friendly, work friendly, food, outdoor, parking, halal, decaf, non-dairy",
                },
                limit: { type: "number", description: "Max results (default 20)" },
            },
            required: ["features"],
        },
    },
},
```

**Step 3: Add to executeTool, run tests, lint, commit**

```bash
git add utils/ai/tools/feature-search.ts utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/feature-search.test.ts
git commit -m "feat(chat): add find_cafes_with_feature tool for complex amenity search"
```

---

### Task 9: Add `get_cafe_stats` Tool 🟡

**Goal:** Let users ask "how many cafes are in the Philippines?" or "what's the average rating in Cebu?" and get aggregate statistics.

**Files:**
- Create: `utils/ai/tools/cafe-stats.ts`
- Modify: `utils/ai/tool-definitions.ts`
- Modify: `utils/ai/chat-stream.ts` and `utils/ai/chat-tools.ts`
- Create: `utils/ai/__tests__/cafe-stats.test.ts`

**Step 1: Create `utils/ai/tools/cafe-stats.ts`**

```ts
import { db } from "@/db"
import { cafes, cafeRatingStats } from "@/db/schema"
import { eq, and, avg, count, ilike, isNotNull } from "drizzle-orm"

export interface CafeStats {
    totalCafes: number
    totalCities: number
    averageRating: number | null
    cafesWithWifi: number
    cafesWithAircon: number
    cafesPetFriendly: number
    cafesWorkFriendly: number
    hiddenGems: number
    verifiedCafes: number
}

export interface CityStats {
    city: string
    province: string
    totalCafes: number
    averageRating: number | null
    hiddenGems: number
}

export async function getCafeStats(
    city?: string
): Promise<{ stats: CafeStats | CityStats; scope: string } | { error: string }> {
    try {
        if (city) {
            const conditions = [
                eq(cafes.isPublished, true),
                ilike(cafes.cityMunicipality, `%${city}%`),
            ]

            const [aggregates, ratingResult] = await Promise.all([
                db
                    .select({
                        total: count(),
                        hiddenGems: count(cafes.isHiddenGem),
                    })
                    .from(cafes)
                    .where(and(...conditions)),
                db
                    .select({ avgRating: avg(cafeRatingStats.averageRating) })
                    .from(cafeRatingStats)
                    .innerJoin(cafes, eq(cafes.id, cafeRatingStats.cafeId))
                    .where(and(...conditions, isNotNull(cafeRatingStats.averageRating))),
            ])

            return {
                stats: {
                    city,
                    province: "",
                    totalCafes: Number(aggregates[0]?.total ?? 0),
                    averageRating: ratingResult[0]?.avgRating ? Number(ratingResult[0].avgRating) : null,
                    hiddenGems: 0,
                },
                scope: city,
            }
        }

        const [totalResult, cityCountResult, ratingResult, featureCounts] = await Promise.all([
            db.select({ count: count() }).from(cafes).where(eq(cafes.isPublished, true)),
            db
                .select({ count: count() })
                .from(cafes)
                .where(eq(cafes.isPublished, true))
                .groupBy(cafes.cityMunicipality),
            db
                .select({ avgRating: avg(cafeRatingStats.averageRating) })
                .from(cafeRatingStats)
                .innerJoin(cafes, eq(cafes.id, cafeRatingStats.cafeId))
                .where(
                    and(
                        eq(cafes.isPublished, true),
                        isNotNull(cafeRatingStats.averageRating)
                    )
                ),
            Promise.all([
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.hasWifi, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.hasAircon, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.isPetFriendly, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.isWorkFriendly, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.isHiddenGem, true))),
                db.select({ count: count() }).from(cafes).where(and(eq(cafes.isPublished, true), eq(cafes.isVerified, true))),
            ]),
        ])

        return {
            stats: {
                totalCafes: Number(totalResult[0]?.count ?? 0),
                totalCities: cityCountResult.length,
                averageRating: ratingResult[0]?.avgRating ? Number(ratingResult[0].avgRating) : null,
                cafesWithWifi: Number(featureCounts[0][0]?.count ?? 0),
                cafesWithAircon: Number(featureCounts[1][0]?.count ?? 0),
                cafesPetFriendly: Number(featureCounts[2][0]?.count ?? 0),
                cafesWorkFriendly: Number(featureCounts[3][0]?.count ?? 0),
                hiddenGems: Number(featureCounts[4][0]?.count ?? 0),
                verifiedCafes: Number(featureCounts[5][0]?.count ?? 0),
            },
            scope: "all",
        }
    } catch (error) {
        console.error("getCafeStats error:", error)
        return { error: "Failed to get cafe statistics" }
    }
}
```

**Step 2: Add tool definition**

```ts
{
    type: "function",
    function: {
        name: "get_cafe_stats",
        description: "Get aggregate statistics about cafes -- total counts, average ratings, feature breakdowns. Can be scoped to a city.",
        parameters: {
            type: "object",
            properties: {
                city: { type: "string", description: "Get stats for a specific city (optional, defaults to all)" },
            },
        },
    },
},
```

**Step 3: Add to executeTool, run tests, lint, commit**

```bash
git add utils/ai/tools/cafe-stats.ts utils/ai/tool-definitions.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts utils/ai/__tests__/cafe-stats.test.ts
git commit -m "feat(chat): add get_cafe_stats tool for aggregate platform statistics"
```

---

### Task 10: Enrich `get_grounds_info` Tool 🟡

**Goal:** Replace the minimal static object with real platform data so the AI can accurately answer "what is Grounds?" and "how do I use this site?"

**Files:**
- Modify: `utils/ai/grounds-info.ts`

**Step 1: Rewrite `utils/ai/grounds-info.ts`**

```ts
import { db } from "@/db"
import { cafes, blogPosts, cafeCrawls, events, profiles } from "@/db/schema"
import { eq, count } from "drizzle-orm"

export interface GroundsInfo {
    platform: string
    url: string
    description: string
    features: {
        name: string
        description: string
    }[]
    howTo: {
        action: string
        steps: string[]
    }[]
    stats: {
        totalCafes: number
        totalBlogPosts: number
        totalCrawls: number
        totalUsers: number
    }
    notes: string[]
}

export async function getGroundsInfo(): Promise<GroundsInfo> {
    let stats = {
        totalCafes: 0,
        totalBlogPosts: 0,
        totalCrawls: 0,
        totalUsers: 0,
    }

    try {
        const [cafeCount, blogCount, crawlCount, userCount] = await Promise.all([
            db.select({ count: count() }).from(cafes).where(eq(cafes.isPublished, true)),
            db.select({ count: count() }).from(blogPosts).where(eq(blogPosts.status, "published")),
            db.select({ count: count() }).from(cafeCrawls).where(eq(cafeCrawls.status, "published")),
            db.select({ count: count() }).from(profiles),
        ])

        stats = {
            totalCafes: Number(cafeCount[0]?.count ?? 0),
            totalBlogPosts: Number(blogCount[0]?.count ?? 0),
            totalCrawls: Number(crawlCount[0]?.count ?? 0),
            totalUsers: Number(userCount[0]?.count ?? 0),
        }
    } catch {
        // Fall back to zeros if DB queries fail
    }

    return {
        platform: "Grounds.ph",
        url: "https://grounds.ph",
        description: "Grounds.ph is a community-driven coffee discovery platform for the Philippines. It helps coffee lovers find, review, and share their favorite cafes across the country.",
        features: [
            { name: "Cafe Directory", description: `Browse ${stats.totalCafes}+ cafes across the Philippines with detailed info on amenities, hours, prices, and more.` },
            { name: "Reviews & Ratings", description: "Read and write reviews for cafes. Rate your experience and help others discover great coffee." },
            { name: "Cafe Crawls", description: "Create and share curated cafe crawl routes -- plan a day of coffee hopping with friends." },
            { name: "Collections", description: "Save cafes to personal collections and share curated lists with the community." },
            { name: "Blog", description: `Read ${stats.totalBlogPosts}+ articles about Philippine coffee culture, cafe reviews, and coffee guides.` },
            { name: "Maps", description: "Find cafes near you with an interactive map showing locations and details." },
            { name: "Events", description: "Discover coffee events, meetups, and tastings happening near you." },
            { name: "Community", description: "Connect with fellow coffee enthusiasts, follow other users, and share your coffee journey." },
            { name: "Hidden Gems", description: "Discover lesser-known cafes that the community loves -- off the beaten path spots." },
            { name: "Badges & Leaderboards", description: "Earn badges for contributions and compete on monthly leaderboards." },
        ],
        howTo: [
            {
                action: "Find a cafe",
                steps: [
                    "Use the search bar or browse by city/region",
                    "Filter by amenities (wifi, sockets, pet-friendly, etc.)",
                    "Check ratings and reviews before visiting",
                ],
            },
            {
                action: "Write a review",
                steps: [
                    "Visit a cafe page and click 'Write a Review'",
                    "Rate your experience and add photos",
                    "Share your thoughts on coffee, ambiance, and service",
                ],
            },
            {
                action: "Create a crawl",
                steps: [
                    "Go to 'Crawls' and click 'Create New'",
                    "Add cafe stops and arrange the route",
                    "Add notes for each stop and publish",
                ],
            },
            {
                action: "Save favorites",
                steps: [
                    "Click the heart/save icon on any cafe",
                    "Organize saved cafes into collections",
                    "Share collections with friends",
                ],
            },
        ],
        stats,
        notes: [
            "Data is community-maintained and user-submitted",
            "Cafe information may not always be up-to-date",
            `Platform has ${stats.totalUsers} registered users`,
            "The AI assistant can help you find cafes, plan crawls, and answer questions about the platform",
        ],
    }
}
```

**Step 2: Update `chat-stream.ts` and `chat-tools.ts` executeTool**

Since `getGroundsInfo` is now async, update the executeTool case:

```ts
case "get_grounds_info": {
    const { getGroundsInfo } = await import("@/utils/ai/grounds-info")
    return await getGroundsInfo()
}
```

**Step 3: Run tests and lint**

```bash
bun test utils/ai/__tests__/
bun lint
```

**Step 4: Commit**

```bash
git add utils/ai/grounds-info.ts utils/ai/chat-stream.ts utils/ai/chat-tools.ts
git commit -m "feat(chat): enrich get_grounds_info with real platform data and feature guide"
```

---

### Task 11: Add Multi-Turn Conversation Memory 🔴

**Goal:** Make the AI remember previous messages in the conversation so users can ask follow-up questions like "what about the other one?" or "show me more like that."

**Files:**
- Modify: `utils/ai/chat-stream.ts` (accept conversation history)
- Modify: `app/api/chat/stream/route.ts` (pass history from client)
- Modify: `utils/types/chat.ts` (add history to request schema)
- Modify: `utils/chat-stream-client.ts` (send history)
- Modify: `components/chat/ChatWindow.tsx` (send recent messages)

**Step 1: Add conversation history to the request schema**

In `utils/types/chat.ts`, update `chatRequestSchema`:

```ts
export const chatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().min(8),
    context: chatContextSchema.optional(),
    history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
    })).max(10).optional(), // Last 10 messages for context
})
```

**Step 2: Update `runChatStream` to use history**

In `utils/ai/chat-stream.ts`, modify the messages construction:

```ts
export async function runChatStream(options: ChatStreamOptions): Promise<void> {
    const { message, sessionId, onChunk, history } = options

    // ... existing validation ...

    // Build messages array with conversation history
    const messages: ChatMessage[] = [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
    ]

    // Add conversation history for multi-turn context
    if (history && history.length > 0) {
        for (const h of history) {
            messages.push({ role: h.role, content: h.content })
        }
    }

    // Add the current user message
    messages.push({ role: "user", content: message })

    // ... rest of the function ...
}
```

Update the `ChatStreamOptions` interface:

```ts
export interface ChatStreamOptions {
    message: string
    sessionId: string
    context?: ChatContext
    history?: { role: "user" | "assistant"; content: string }[]
    onChunk: (chunk: ChatStreamChunk) => void | Promise<void>
}
```

**Step 3: Update the API route to pass history**

In `app/api/chat/stream/route.ts`, extract history from the request body and pass it:

```ts
const body = await request.json()
const parsed = chatRequestSchema.parse(body)

// ... existing validation ...

await runChatStream({
    message: parsed.message,
    sessionId,
    context: parsed.context,
    history: parsed.history,
    onChunk: async (chunk) => {
        // ... existing chunk handling ...
    },
})
```

**Step 4: Update the client to send history**

In `utils/chat-stream-client.ts`, update the function signature:

```ts
export async function sendChatMessageStream(
    message: string,
    onChunk: (chunk: ChatStreamChunk) => void | Promise<void>,
    context: {
        recentCafes: unknown[]
        recentToolCalls: { toolName: string; params: unknown; result: unknown }[]
        pathname: string
        pageTitle: string
    },
    history?: { role: "user" | "assistant"; content: string }[]
): Promise<void> {
    const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context, history }),
    })
    // ... rest unchanged ...
}
```

**Step 5: Update ChatWindow to pass history**

In `ChatWindow.tsx`, when calling `sendChatMessageStream`, build history from recent messages:

```ts
const buildHistory = useCallback(() => {
    // Send last 10 messages (5 exchanges) for context
    return messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
    }))
}, [messages])

// In processStreamResponse:
await sendChatMessageStream(
    `${content}${locationHint}`,
    onChunkCallback,
    { ... },
    buildHistory()
)
```

**Step 6: Run tests and lint**

```bash
bun test components/chat/__tests__/ utils/ai/__tests__/
bun lint
```

**Step 7: Commit**

```bash
git add utils/types/chat.ts utils/ai/chat-stream.ts app/api/chat/stream/route.ts utils/chat-stream-client.ts components/chat/ChatWindow.tsx
git commit -m "feat(chat): add multi-turn conversation memory for follow-up questions"
```

---

### Task 12: Remove Legacy Non-Streaming Path 🟡

**Goal:** Remove the unused `app/api/actions/chat.ts` and the duplicated `utils/ai/chat-tools.ts` since the UI exclusively uses the streaming path.

**Files:**
- Delete: `app/api/actions/chat.ts`
- Delete: `utils/ai/chat-tools.ts`
- Delete: `app/api/actions/__tests__/chat-actions.test.ts`
- Delete: `utils/ai/__tests__/chat-tools.test.ts`
- Verify: No other files import from these modules

**Step 1: Verify no imports reference the legacy files**

```bash
bun run -e "
const fs = require('fs');
const path = require('path');
function search(dir) {
  for (const f of fs.readdirSync(dir, {withFileTypes: true})) {
    if (f.name === 'node_modules' || f.name === '.next') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { search(p); continue; }
    if (!/\.(ts|tsx)$/.test(f.name)) continue;
    const content = fs.readFileSync(p, 'utf8');
    if (content.includes('chat-tools') || content.includes(\"from '@/app/api/actions/chat'\")) {
      console.log(p);
    }
  }
}
search('.');
"
```

**Step 2: Delete the files**

```bash
rm app/api/actions/chat.ts
rm utils/ai/chat-tools.ts
rm app/api/actions/__tests__/chat-actions.test.ts
rm utils/ai/__tests__/chat-tools.test.ts
```

**Step 3: Run tests and lint**

```bash
bun test
bun lint
```

**Step 4: Commit**

```bash
git rm app/api/actions/chat.ts utils/ai/chat-tools.ts app/api/actions/__tests__/chat-actions.test.ts utils/ai/__tests__/chat-tools.test.ts
git commit -m "refactor(chat): remove legacy non-streaming chat path and duplicated code"
```

---

### Task 13: Add Shared `ChatMessage` Type (from existing audit) 🟡

**Goal:** Extract the duplicated `Message` interface into `utils/types/chat.ts`.

**Files:**
- Modify: `utils/types/chat.ts` (add ChatMessage interface)
- Modify: `components/chat/ChatWindow.tsx` (import shared type)
- Modify: `components/chat/ChatMessage.tsx` (import shared type)

**Step 1: Add to `utils/types/chat.ts`**

After the existing exports (line ~156):

```ts
export interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    crawlDraft?: ChatCrawlDraft
}
```

**Step 2: Update both components to import from shared**

In `ChatWindow.tsx` and `ChatMessage.tsx`, remove local `Message` interface and import `ChatMessage as ChatMessageType` from `@/utils/types/chat`.

**Step 3: Run tests and lint**

```bash
bun test components/chat/__tests__/
bun lint
```

**Step 4: Commit**

```bash
git add utils/types/chat.ts components/chat/ChatWindow.tsx components/chat/ChatMessage.tsx
git commit -m "refactor(chat): extract shared ChatMessage type to utils/types/chat"
```

---

### Task 14: Consolidate `executeTool` into Shared Module 🟡

**Goal:** After adding all 15 tools, the `executeTool` function will be duplicated in both `chat-stream.ts` (and the now-deleted `chat-tools.ts`). Extract it.

**Files:**
- Create: `utils/ai/tool-executor.ts` (shared executeTool)
- Modify: `utils/ai/chat-stream.ts` (import from shared)

**Step 1: Create `utils/ai/tool-executor.ts`**

```ts
import { runCafeQuery } from "@/utils/ai/tools/cafe-query-runner"
import {
    getCafeBySlug,
    compareCafes,
    listCitiesWithCounts,
    getNearbyCafes,
    getTopRatedCafes,
} from "@/utils/ai/tools/cafe-insights"
import { CafeQueryInput } from "@/utils/ai/tools/cafe-query"
import { GeoPoint } from "@/utils/ai/tools/cafe-geo"

export async function executeTool(toolName: string, args: string): Promise<unknown> {
    const parsed = JSON.parse(args)

    switch (toolName) {
        case "query_cafes":
            return runCafeQuery(parsed as CafeQueryInput)
        case "get_cafe_by_slug":
            return getCafeBySlug(parsed.slug as string)
        case "compare_cafes":
            return compareCafes(parsed.slugA as string, parsed.slugB as string)
        case "list_cities":
            return listCitiesWithCounts()
        case "get_nearby_cafes":
            return getNearbyCafes({ lat: parsed.lat, lng: parsed.lng } as GeoPoint, parsed.radiusKm as number)
        case "get_top_rated":
            return getTopRatedCafes(parsed.city as string, parsed.limit ?? 10)
        case "get_grounds_info": {
            const { getGroundsInfo } = await import("@/utils/ai/grounds-info")
            return getGroundsInfo()
        }
        case "get_cafe_reviews": {
            const { getCafeReviews } = await import("@/utils/ai/tools/cafe-reviews")
            return getCafeReviews(parsed.slug as string, parsed.limit ?? 5)
        }
        case "get_cafe_menu": {
            const { getCafeMenu } = await import("@/utils/ai/tools/cafe-menu")
            return getCafeMenu(parsed.slug as string, parsed.category)
        }
        case "get_cafe_hours": {
            const { getCafeHours } = await import("@/utils/ai/tools/cafe-hours")
            return getCafeHours(parsed.slug as string)
        }
        case "search_blog_posts": {
            const { searchBlogPosts } = await import("@/utils/ai/tools/blog-search")
            return searchBlogPosts(parsed.query as string, parsed.limit ?? 5)
        }
        case "get_upcoming_events": {
            const { getUpcomingEvents } = await import("@/utils/ai/tools/events")
            return getUpcomingEvents(parsed.city, parsed.limit ?? 10)
        }
        case "find_hidden_gems": {
            const { findHiddenGems } = await import("@/utils/ai/tools/hidden-gems")
            return findHiddenGems(parsed.city, parsed.limit ?? 10)
        }
        case "find_cafes_with_feature": {
            const { findCafesWithFeature } = await import("@/utils/ai/tools/feature-search")
            return findCafesWithFeature(parsed)
        }
        case "get_cafe_stats": {
            const { getCafeStats } = await import("@/utils/ai/tools/cafe-stats")
            return getCafeStats(parsed.city)
        }
        default:
            throw new Error(`Unknown tool: ${toolName}`)
    }
}
```

**Step 2: Update `chat-stream.ts`**

Replace the local `executeTool` function with an import:

```ts
import { executeTool } from "@/utils/ai/tool-executor"
// Remove: the entire executeTool function (~35 lines)
```

**Step 3: Run tests and lint**

```bash
bun test utils/ai/__tests__/
bun lint
```

**Step 4: Commit**

```bash
git add utils/ai/tool-executor.ts utils/ai/chat-stream.ts
git commit -m "refactor(chat): consolidate executeTool into shared tool-executor module"
```

---

### Task 15: Fix Hardcoded Remaining Count and Remove Debug Logs 🟡

**Goal:** Fix the hardcoded `remaining: 10` in stream complete chunks and remove debug console.logs.

**Files:**
- Modify: `utils/ai/chat-stream.ts` (remove remaining from complete chunks)
- Modify: `utils/types/chat.ts` (make remaining optional on complete chunk)

**Step 1: Make `remaining` optional on the `complete` chunk type**

In `utils/types/chat.ts`, line ~134:

```ts
// Change from:
remaining: z.number().int(),
// To:
remaining: z.number().int().optional(),
```

**Step 2: Remove `remaining: 10` from all `complete` chunk emissions in `chat-stream.ts`**

There are 4 occurrences. Remove the `remaining` field from each `complete` chunk since the real count comes from the `remaining` chunk sent by the route handler.

**Step 3: Remove debug console.log statements**

In `chat-stream.ts`, find and remove all `console.log` debug statements (keep `console.error` for actual errors).

**Step 4: Run tests and lint**

```bash
bun test utils/ai/__tests__/ components/chat/__tests__/
bun lint
```

**Step 5: Commit**

```bash
git add utils/ai/chat-stream.ts utils/types/chat.ts
git commit -m "fix(chat): remove hardcoded remaining count and debug console.logs"
```

---

### Task 16: Add Suggested Prompts to Empty State 🟢

**Goal:** Show clickable suggested prompts when the chat is empty so users know what to ask.

**Files:**
- Modify: `components/chat/ChatWindow.tsx` (add suggested prompt chips)

**Step 1: Add suggested prompts array**

```ts
const SUGGESTED_PROMPTS = [
    { label: "Best cafes in Manila", icon: "🏙️" },
    { label: "Find hidden gems near me", icon: "💎" },
    { label: "Work-friendly cafes with WiFi", icon: "💻" },
    { label: "Plan a cafe crawl in Cebu", icon: "🗺️" },
    { label: "What is Grounds.ph?", icon: "☕" },
]
```

**Step 2: Replace empty state with clickable prompts**

In the empty state section of ChatWindow, replace the static text with clickable chips:

```tsx
{messages.length === 0 && (
    <motion.div
        key="messages-entry"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className='flex flex-col items-center justify-center text-center space-y-4'
    >
        <motion.div
            className='p-4 bg-secondary/10 rounded-2xl'
            animate={{ y: [0, -5, 0], rotate: [0, 2, -2, 0] }}
            transition={{ duration: 4, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
        >
            <Sparkles className='w-8 h-8 text-secondary' />
        </motion.div>
        <div className='space-y-1'>
            <p className='text-sm font-medium'>Ask me anything about cafes!</p>
            <p className='text-xs text-text/50'>Locations, recommendations, amenities...</p>
        </div>
        <div className='flex flex-wrap gap-2 justify-center pt-2'>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
                <motion.button
                    key={prompt.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setInput(prompt.label)}
                    className='px-3 py-2 text-xs rounded-full border border-primary/15 bg-primary/5 hover:bg-primary/10 transition-colors text-left'
                >
                    <span className='mr-1'>{prompt.icon}</span>
                    {prompt.label}
                </motion.button>
            ))}
        </div>
    </motion.div>
)}
```

**Step 3: Run tests and lint**

```bash
bun test components/chat/__tests__/
bun lint
```

**Step 4: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "feat(chat): add clickable suggested prompts to empty chat state"
```

---

### Task 17: Add Thumbs Up/Down Feedback on Assistant Messages 🟢

**Goal:** Let users rate AI responses so we can track quality and identify issues.

**Files:**
- Modify: `components/chat/ChatMessage.tsx` (add feedback buttons)
- Modify: `utils/types/chat.ts` (add feedback field to ChatMessage)
- Create: `app/api/actions/chat-feedback.ts` (server action to log feedback)

**Step 1: Add feedback to ChatMessage type**

In `utils/types/chat.ts`, update the `ChatMessage` interface:

```ts
export interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    cafes?: ChatCafeCard[]
    cardContext?: ChatCardContext
    crawlDraft?: ChatCrawlDraft
    feedback?: "positive" | "negative" | null
}
```

**Step 2: Create feedback server action**

```ts
// app/api/actions/chat-feedback.ts
"use server"

import { z } from "zod"

const feedbackSchema = z.object({
    messageId: z.string(),
    feedback: z.enum(["positive", "negative"]),
    messageContent: z.string().max(500),
})

export async function submitChatFeedback(
    input: z.infer<typeof feedbackSchema>
): Promise<{ success: boolean; error?: string }> {
    try {
        const parsed = feedbackSchema.parse(input)

        // Log to console for now -- can be stored in DB later
        console.log(`[Chat Feedback] ${parsed.feedback}: ${parsed.messageId}`)

        return { success: true }
    } catch (error) {
        console.error("Chat feedback error:", error)
        return { success: false, error: "Failed to submit feedback" }
    }
}
```

**Step 3: Add feedback buttons to ChatMessage**

In `ChatMessage.tsx`, add thumbs up/down buttons below assistant messages:

```tsx
{message.role === "assistant" && (
    <div className='flex items-center gap-1 mt-1'>
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleFeedback("positive")}
            className={cn(
                "p-1 rounded transition-colors",
                message.feedback === "positive"
                    ? "text-green-500 bg-green-500/10"
                    : "text-text/30 hover:text-text/60"
            )}
            aria-label="Helpful response"
        >
            <ThumbsUp className='w-3 h-3' />
        </motion.button>
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleFeedback("negative")}
            className={cn(
                "p-1 rounded transition-colors",
                message.feedback === "negative"
                    ? "text-red-500 bg-red-500/10"
                    : "text-text/30 hover:text-text/60"
            )}
            aria-label="Not helpful"
        >
            <ThumbsDown className='w-3 h-3' />
        </motion.button>
    </div>
)}
```

**Step 4: Run tests and lint**

```bash
bun test components/chat/__tests__/
bun lint
```

**Step 5: Commit**

```bash
git add components/chat/ChatMessage.tsx utils/types/chat.ts app/api/actions/chat-feedback.ts
git commit -m "feat(chat): add thumbs up/down feedback on assistant messages"
```

---

### Task 18: Add Content Moderation on User Messages 🟡

**Goal:** Filter inappropriate, abusive, or off-topic user messages before sending to the AI.

**Files:**
- Create: `utils/chat-moderation.ts` (content filter)
- Modify: `app/api/chat/stream/route.ts` (apply moderation)

**Step 1: Create `utils/chat-moderation.ts`**

```ts
const BLOCKED_PATTERNS = [
    /\b(fuck|shit|bitch|ass|damn|crap)\b/i,
    /\b(kill|die|murder|suicide)\b/i,
    /\b(hack|exploit|inject|sql|drop table)\b/i,
]

const OFF_TOPIC_INDICATORS = [
    /\b(write me a poem|tell me a joke|what's the weather)\b/i,
]

export interface ModerationResult {
    allowed: boolean
    reason?: string
    flag?: "profanity" | "off_topic" | "injection"
}

export function moderateMessage(text: string): ModerationResult {
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(text)) {
            return {
                allowed: false,
                reason: "Your message contains content that isn't allowed. Please keep conversations about cafes and coffee.",
                flag: pattern.source.includes("kill") ? "profanity" : "profanity",
            }
        }
    }

    // Check for potential injection attempts
    if (text.includes("ignore previous instructions") || text.includes("system prompt")) {
        return {
            allowed: false,
            reason: "I can only help with cafe and coffee-related questions.",
            flag: "injection",
        }
    }

    return { allowed: true }
}
```

**Step 2: Apply moderation in the API route**

In `app/api/chat/stream/route.ts`, after parsing the request:

```ts
import { moderateMessage } from "@/utils/chat-moderation"

// After validation, before rate limit check:
const moderation = moderateMessage(parsed.message)
if (!moderation.allowed) {
    return new Response(
        JSON.stringify({ type: "error", error: moderation.reason }),
        { status: 400, headers: { "Content-Type": "application/json" } }
    )
}
```

**Step 3: Run tests and lint**

```bash
bun test utils/__tests__/ app/api/chat-status/__tests__/
bun lint
```

**Step 4: Commit**

```bash
git add utils/chat-moderation.ts app/api/chat/stream/route.ts
git commit -m "feat(chat): add content moderation filter for user messages"
```

---

### Task 19: Add Smart Page Context to System Prompt 🟢

**Goal:** When the user is on a cafe page, automatically include that cafe's info in the context so the AI knows what page they're viewing.

**Files:**
- Modify: `utils/ai/chat-stream.ts` (inject page context into system prompt)

**Step 1: Inject cafe context into system prompt**

In `runChatStream`, after building the messages array, add context-aware system message:

```ts
// After messages.push({ role: "user", content: message })
if (options.context?.cafeSlug) {
    const cafeInfo = await getCafeBySlug(options.context.cafeSlug)
    if (cafeInfo) {
        messages.splice(1, 0, {
            role: "system",
            content: `The user is currently viewing the cafe page for "${cafeInfo.name}" (${cafeInfo.slug}) in ${cafeInfo.city_municipality}, ${cafeInfo.province}. Use this context when answering their questions.`,
        })
    }
}
```

**Step 2: Add crawl context similarly**

```ts
if (options.context?.crawlSlug) {
    messages.splice(1, 0, {
        role: "system",
        content: `The user is currently viewing a cafe crawl. Crawl slug: ${options.context.crawlSlug}. Help them with questions about this crawl.`,
    })
}
```

**Step 3: Run tests and lint**

```bash
bun test utils/ai/__tests__/
bun lint
```

**Step 4: Commit**

```bash
git add utils/ai/chat-stream.ts
git commit -m "feat(chat): inject smart page context into AI system prompt"
```

---

### Task 20: Final Test Verification and Build Check 🟢

**Goal:** Ensure everything works end-to-end after all changes.

**Step 1: Run all tests**

```bash
bun test --timeout 30000
```

**Step 2: Fix any broken tests**

Common issues:
- Import paths changed after refactoring
- New tool functions need mocks in tests
- Snapshot updates for new UI elements

**Step 3: Run lint**

```bash
bun lint
```

**Step 4: Run build**

```bash
bun build
```

**Step 5: Run type check**

```bash
bun run typecheck
```

**Step 6: Final commit (test fixes only)**

```bash
git add -A
git commit -m "test(chat): update tests for new tools and architecture changes"
```

---

## Execution Order

Tasks should be executed in this order due to dependencies:

### Phase 1: Foundation (sequential)
1. **Task 1** -- Deduplicate tools and system prompt (enables all new tool tasks)
2. **Task 13** -- Shared ChatMessage type (enables Task 17)
3. **Task 15** -- Fix hardcoded remaining + remove debug logs

### Phase 2: New Tools (parallelizable after Phase 1)
4. **Task 2** -- get_cafe_reviews
5. **Task 3** -- get_cafe_menu
6. **Task 4** -- get_cafe_hours
7. **Task 5** -- search_blog_posts
8. **Task 6** -- get_upcoming_events
9. **Task 7** -- find_hidden_gems
10. **Task 8** -- find_cafes_with_feature
11. **Task 9** -- get_cafe_stats
12. **Task 10** -- Enrich get_grounds_info

### Phase 3: Architecture (after Phase 2)
13. **Task 14** -- Consolidate executeTool (depends on all tools being added)
14. **Task 12** -- Remove legacy path (after Task 14)
15. **Task 11** -- Multi-turn conversation memory

### Phase 4: UX Polish (parallelizable)
16. **Task 16** -- Suggested prompts
17. **Task 17** -- Feedback buttons (depends on Task 13)
18. **Task 18** -- Content moderation
19. **Task 19** -- Smart page context

### Phase 5: Verification
20. **Task 20** -- Final test verification and build

**Parallelization notes:**
- Tasks 2-10 (new tools) can all be done in parallel once Task 1 is complete
- Tasks 16, 17, 18, 19 (UX) are independent and can be parallelized
- Tasks 11, 12, 14 have clear dependencies and should be sequential

---

## Post-Implementation Checklist

### Tools
- [ ] 15 total tools defined in `tool-definitions.ts`
- [ ] All tools have matching `executeTool` cases in `tool-executor.ts`
- [ ] All tools have at least one test file
- [ ] System prompt documents all 15 tools with usage guidance

### Architecture
- [ ] Single source of truth for tool definitions (`tool-definitions.ts`)
- [ ] Single source of truth for tool execution (`tool-executor.ts`)
- [ ] No duplicated code between `chat-tools.ts` and `chat-stream.ts`
- [ ] Legacy `chat-tools.ts` and `app/api/actions/chat.ts` deleted
- [ ] `get_grounds_info` returns real platform data from DB

### Conversation
- [ ] Multi-turn memory sends last 10 messages to AI
- [ ] Follow-up questions like "what about the other one?" work
- [ ] Page context (current cafe/crawl) injected into system prompt
- [ ] Content moderation blocks profanity and injection attempts

### UX
- [ ] 5 suggested prompts shown in empty chat state
- [ ] Thumbs up/down feedback on every assistant message
- [ ] All existing animations and haptics still work

### Quality
- [ ] `bun lint` passes clean
- [ ] `bun test` passes all tests
- [ ] `bun build` succeeds
- [ ] No `console.log` debug statements in production code
- [ ] No `any` types; all new code uses proper TypeScript types
- [ ] All new tool files follow the established pattern (DB query, error handling, return types)
