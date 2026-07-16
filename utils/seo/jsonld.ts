const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

export interface BlogPostingInput {
  title: string
  url: string
  description: string
  imageUrl?: string
  authorName: string
  authorUrl?: string
  datePublished: string
  dateModified?: string
}

export function buildBlogPostingJsonLd(input: BlogPostingInput) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    url: input.url,
    ...(input.imageUrl && { image: input.imageUrl }),
    author: {
      "@type": "Person",
      name: input.authorName,
      ...(input.authorUrl && { url: input.authorUrl }),
    },
    datePublished: input.datePublished,
    ...(input.dateModified && { dateModified: input.dateModified }),
    publisher: {
      "@type": "Organization",
      name: "GroundsPH",
      url: BASE_URL,
    },
  }
}

export interface ItemListElement {
  "@type": "ListItem"
  position: number
  name: string
  url: string
}

export function buildItemListElement(
  name: string,
  url: string,
  position: number
): ItemListElement {
  return { "@type": "ListItem", position, name, url }
}

export function buildItemListJsonLd(
  elements: ItemListElement[],
  listType: "collection" | "crawl" | "listing" = "listing"
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name:
      listType === "collection"
        ? "Cafe Collection"
        : listType === "crawl"
          ? "Cafe Crawl"
          : "Cafe Listing",
    numberOfItems: elements.length,
    itemListElement: elements,
  }
}