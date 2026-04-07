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
