export interface CafeImageRow {
    id: string
    name: string
    thumbnail: string | null
    gallery: string[] | null
}

export interface CafeImageUrl {
    cafeId: string
    cafeName: string
    url: string
}

export interface CheckedCafeImageUrl extends CafeImageUrl {
    status: number | null
}

export interface BrokenImageSummary {
    cafeId: string
    cafeName: string
    brokenUrls: string[]
}

/** Values that are not real assets and must not be probed or reported. */
const PLACEHOLDER_COVERS = new Set(["placeholder", "", "null"])

export function collectCafeImageUrls(rows: CafeImageRow[]): CafeImageUrl[] {
    const seen = new Set<string>()
    const collected: CafeImageUrl[] = []

    for (const row of rows) {
        const candidates = [
            ...(row.thumbnail && !PLACEHOLDER_COVERS.has(row.thumbnail) ? [row.thumbnail] : []),
            ...(row.gallery ?? []),
        ]

        for (const url of candidates) {
            if (!url || seen.has(url)) continue
            seen.add(url)
            collected.push({ cafeId: row.id, cafeName: row.name, url })
        }
    }

    return collected
}

export function summarizeBrokenImages(checked: CheckedCafeImageUrl[]): BrokenImageSummary[] {
    const byCafe = new Map<string, BrokenImageSummary>()

    for (const entry of checked) {
        const broken = entry.status === null || entry.status >= 400
        if (!broken) continue

        const existing = byCafe.get(entry.cafeId) ?? {
            cafeId: entry.cafeId,
            cafeName: entry.cafeName,
            brokenUrls: [],
        }
        existing.brokenUrls.push(entry.url)
        byCafe.set(entry.cafeId, existing)
    }

    return [...byCafe.values()]
}
