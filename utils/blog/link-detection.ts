// utils/blog/link-detection.ts
const CAFE_LINK_REGEX =
  /(?:https?:\/\/)?(?:www\.)?grounds\.ph\/cafes\/([a-z0-9-]+)(?:[/?#\s]|$)|\/cafes\/([a-z0-9-]+)(?:[/?#\s]|$)/gi

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
