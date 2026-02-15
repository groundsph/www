// utils/blog/link-detection.ts
const CAFE_LINK_REGEX =
  /(?:https?:\/\/)?(?:www\.)?grounds\.ph\/cafes\/([a-z0-9-]+)(?:[/?#,;!.\s]|$)|(?:^|\s|\()\/cafes\/([a-z0-9-]+)(?:[/?#,;!.\s]|$)/gi

/**
 * Extracts unique cafe slugs from blog post content by scanning for
 * grounds.ph cafe links (both absolute and relative URLs).
 *
 * Matches URLs like:
 * - https://grounds.ph/cafes/slug-name
 * - http://grounds.ph/cafes/slug-name
 * - https://www.grounds.ph/cafes/slug-name
 * - /cafes/slug-name
 *
 * Slugs are normalized to lowercase and deduplicated.
 *
 * @param content - The blog post content to scan
 * @returns Array of unique cafe slugs in lowercase, empty array if content is falsy
 */
export function extractCafeSlugsFromContent(content: string): string[] {
  if (!content) return []
  const seen = new Set<string>()
  const results: string[] = []
  for (const match of content.matchAll(CAFE_LINK_REGEX)) {
    const slug = (match[1] || match[2] || "").toLowerCase()
    if (slug && !seen.has(slug)) {
      seen.add(slug)
      results.push(slug)
    }
  }
  return results
}
