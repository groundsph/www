interface CrawlMapItem {
    name: string
    slug: string
    thumbnail: string | null
    lat: number | null
    lng: number | null
    sortOrder: number
}

export interface MapPoint {
    lat: number
    lng: number
    imageUrl: string | null
    label: string
    index: number
    cafeSlug: string
}

export function buildCrawlMapPoints(items: CrawlMapItem[]): MapPoint[] {
    return items
        .filter((item): item is CrawlMapItem & { lat: number; lng: number } =>
            item.lat != null && item.lng != null
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item, index) => ({
            lat: item.lat,
            lng: item.lng,
            imageUrl: item.thumbnail,
            label: item.name,
            index: index + 1,
            cafeSlug: item.slug,
        }))
}
