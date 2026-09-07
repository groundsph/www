import { getPublishedBlogPosts } from "@/app/api/actions/blog"
import { buildRssXml, toRfc822 } from "@/utils/blog/feed"
import type { BlogPost } from "@/utils/types/blog"

export const dynamic = "force-dynamic"

export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://grounds.ph"

    let posts: BlogPost[] = []
    try {
        // Latest published posts (server action maps authors + cafes).
        const result = await getPublishedBlogPosts({ page: 1, pageSize: 25 })
        posts = result.posts
    } catch (error) {
        console.error("Failed to build RSS feed:", error)
    }

    const updated = posts.length > 0 ? posts[0].published_at ?? null : null

    const xml = buildRssXml(posts, baseUrl, {
        title: "GroundsPH Blog",
        link: `${baseUrl}/blog`,
        description: "Latest cafe news, guides, and community stories from GroundsPH.",
        selfUrl: `${baseUrl}/feed.xml`,
        language: "en-US",
        // published_at is an ISO string; RSS requires RFC 822.
        lastBuildDate: updated ? toRfc822(updated) : new Date().toUTCString(),
    })

    return new Response(xml, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
    })
}
