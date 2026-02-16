import { describe, it, expect, beforeEach, mock } from "bun:test"

// Track revalidation calls
let revalidatedPaths: string[] = []

// Mock next/cache before importing blog actions
mock.module("next/cache", () => ({
    revalidatePath: (path: string) => {
        revalidatedPaths.push(path)
    },
}))

// Mock next/headers
mock.module("next/headers", () => ({
    headers: () =>
        Promise.resolve({
            get: () => null,
        }),
}))

// Mock auth to return null (unauthenticated) by default
let mockUser: { id: string } | null = null
mock.module("@/lib/auth", () => ({
    getCurrentUser: () => Promise.resolve(mockUser),
}))

// Create a proper Drizzle-like query builder mock
interface QueryBuilder {
    from: () => QueryBuilder
    where: () => QueryBuilder
    and: () => QueryBuilder
    orderBy: () => QueryBuilder
    limit: () => QueryBuilder
    offset: () => Promise<unknown[]>
}

const createMockQueryBuilder = (returnValue: unknown[] = []): QueryBuilder => {
    const builder: QueryBuilder = {
        from: () => builder,
        where: () => builder,
        and: () => builder,
        orderBy: () => builder,
        limit: () => builder,
        offset: () => Promise.resolve(returnValue),
    }
    return builder
}

// Mock the database
mock.module("@/db", () => ({
    db: {
        select: () => createMockQueryBuilder([]),
        insert: () => ({
            values: () => ({
                returning: () => Promise.resolve([{ slug: "test-post" }]),
            }),
        }),
    },
}))

// Import the actual functions after mocking
const {
    createCommunityBlogPost,
    getUserBlogPosts,
    getWriterBlogPosts,
} = await import("../blog")

describe("blog actions", () => {
    beforeEach(() => {
        revalidatedPaths = []
        mockUser = null
    })

    describe("createCommunityBlogPost validation", () => {
        it("returns error when title is empty string", async () => {
            const result = await createCommunityBlogPost({
                title: "",
                content: "Valid content here",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Title is required")
        })

        it("returns error when title contains only whitespace", async () => {
            const result = await createCommunityBlogPost({
                title: "   ",
                content: "Valid content here",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Title is required")
        })

        it("returns error when content is empty string", async () => {
            const result = await createCommunityBlogPost({
                title: "Valid Title",
                content: "",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Content is required")
        })

        it("returns error when content contains only whitespace", async () => {
            const result = await createCommunityBlogPost({
                title: "Valid Title",
                content: "   ",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Content is required")
        })

        it("does not revalidate when validation fails", async () => {
            await createCommunityBlogPost({
                title: "",
                content: "Some content",
            })

            expect(revalidatedPaths).not.toContain("/blog")
        })
    })

    describe("createCommunityBlogPost with valid input", () => {
        it("accepts valid title and content", async () => {
            mockUser = { id: "user123" }

            const result = await createCommunityBlogPost({
                title: "My Post Title",
                content: "This is valid content for the post.",
            })

            expect(result).toBeDefined()
        })

        it("accepts optional excerpt and cover_image", async () => {
            mockUser = { id: "user123" }

            const result = await createCommunityBlogPost({
                title: "My Post",
                excerpt: "A brief excerpt",
                content: "Full content here",
                cover_image: "https://example.com/image.jpg",
            })

            expect(result).toBeDefined()
        })
    })

    describe("getUserBlogPosts", () => {
        it("returns empty array when user is not authenticated", async () => {
            mockUser = null

            const result = await getUserBlogPosts()

            expect(result.posts).toEqual([])
            expect(result.total).toBe(0)
            expect(result.page).toBe(1)
            expect(result.pageSize).toBe(20)
            expect(result.hasMore).toBe(false)
        })

        it("returns default pagination values when authenticated", async () => {
            mockUser = { id: "user123" }

            const result = await getUserBlogPosts()

            expect(result.page).toBe(1)
            expect(result.pageSize).toBe(20)
        })

        it("accepts custom page and pageSize", async () => {
            mockUser = { id: "user123" }

            const result = await getUserBlogPosts({ page: 2, pageSize: 10 })

            expect(result.page).toBe(2)
            expect(result.pageSize).toBe(10)
        })
    })

    describe("getWriterBlogPosts", () => {
        it("returns empty result when not authenticated", async () => {
            mockUser = null

            const result = await getWriterBlogPosts()

            expect(result.posts).toEqual([])
            expect(result.total).toBe(0)
            expect(result.hasMore).toBe(false)
        })

        it("accepts filter parameters (returns defaults for non-writer)", async () => {
            mockUser = { id: "user123" } // Regular user, not writer

            const result = await getWriterBlogPosts({
                page: 1,
                pageSize: 15,
                status: "published",
                category: "guides",
                search: "coffee",
            })

            // Non-writers get empty results with default pagination
            expect(result.posts).toEqual([])
            expect(result.total).toBe(0)
            expect(result.hasMore).toBe(false)
        })

        it("returns default values for unauthenticated user", async () => {
            mockUser = null

            const result = await getWriterBlogPosts()

            expect(result.posts).toEqual([])
            expect(result.total).toBe(0)
            expect(result.page).toBe(1)
            expect(result.pageSize).toBe(20)
            expect(result.hasMore).toBe(false)
        })
    })

    describe("revalidation behavior", () => {
        it("revalidatePath is available as a function", async () => {
            const { revalidatePath } = await import("next/cache")
            expect(typeof revalidatePath).toBe("function")

            revalidatePath("/test")
            expect(revalidatedPaths).toContain("/test")
        })
    })
})
