import { normalizeLatLng } from "@/utils/map/coords"

interface CrawlMapItem {
    name: string
    slug: string
    thumbnail: string | null
    lat: unknown
    lng: unknown
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
        .map((item) => ({ item, coords: normalizeLatLng(item) }))
        .filter((entry): entry is { item: CrawlMapItem; coords: { lat: number; lng: number } } =>
            entry.coords !== null
        )
        .sort((a, b) => a.item.sortOrder - b.item.sortOrder)
        .map(({ item, coords }, index) => ({
            lat: coords.lat,
            lng: coords.lng,
            imageUrl: item.thumbnail,
            label: item.name,
            index: index + 1,
            cafeSlug: item.slug,
        }))
}
