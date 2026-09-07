import type { BlogPost } from "@/utils/types/blog"

// Escape XML special characters in text nodes / attributes.
export function escapeXml(value: string | null | undefined): string {
    if (!value) return ""
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

// RFC 822 date (Wed, 02 Oct 2002 13:00:00 GMT) required by RSS 2.0.
export function toRfc822(date: string | Date | null): string {
    if (!date) return new Date(0).toUTCString()
    const d = typeof date === "string" ? new Date(date) : date
    return isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString()
}

export function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function buildEnclosure(post: BlogPost): string {
    if (!post.cover_image) return ""
    const type = post.cover_image.endsWith(".png") ? "image/png" : "image/jpeg"
    return `\n      <enclosure url="${escapeXml(post.cover_image)}" type="${type}"/>`
}

function buildItem(post: BlogPost, baseUrl: string): string {
    const url = `${baseUrl}/blog/${post.slug}`
    const published = toRfc822(post.published_at)

    const title = escapeXml(post.title)
    const description = escapeXml(post.excerpt || stripHtml(post.content).slice(0, 500))
    const contentEncoded = escapeXml(post.content || "")
    const guid = post.id
    const category = post.category ? escapeXml(post.category) : ""
    const creator = escapeXml(post.author?.display_name ?? "")

    return `    <item>
      <title>${title}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${published}</pubDate>${category ? `\n      <category>${category}</category>` : ""}${creator ? `\n      <dc:creator>${creator}</dc:creator>` : ""}${buildEnclosure(post)}
      <description>${description}</description>
      <content:encoded>${contentEncoded}</content:encoded>
    </item>`
}

export interface RssChannel {
    title: string
    link: string
    description: string
    selfUrl: string
    language?: string
    lastBuildDate?: string
}

export function buildRssXml(
    posts: BlogPost[],
    baseUrl: string,
    channel: RssChannel,
): string {
    const updated = channel.lastBuildDate
        ?? (posts.length > 0 ? toRfc822(posts[0].published_at) : undefined)

    const items = posts.map((p) => buildItem(p, baseUrl)).join("\n")

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>${escapeXml(channel.language ?? "en-US")}</language>${updated ? `\n    <lastBuildDate>${updated}</lastBuildDate>` : ""}
    <atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`
}
