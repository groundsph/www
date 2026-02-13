export interface PassportCafeRow {
    cafeName: string
    cafeSlug: string
    cafeThumbnail: string | null
    badgeStampUrl: string | null
    firstVisit: string | null
}

export interface PassportCafeViewModel {
    name: string
    slug: string
    thumbnail: string | null
    badge_stamp_url: string | null
    visited_at: string | null
}

export function mapPassportCafe(row: PassportCafeRow): PassportCafeViewModel {
    return {
        name: row.cafeName,
        slug: row.cafeSlug,
        thumbnail: row.cafeThumbnail,
        badge_stamp_url: row.badgeStampUrl,
        visited_at: row.firstVisit,
    }
}
