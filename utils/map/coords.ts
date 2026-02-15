export interface LatLng {
    lat: number
    lng: number
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function isInRange(lat: number, lng: number) {
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

export function normalizeLatLng(
    point: { lat: unknown; lng: unknown } | null | undefined
): LatLng | null {
    if (!point) return null
    const lat = toFiniteNumber(point.lat)
    const lng = toFiniteNumber(point.lng)
    if (lat === null || lng === null) return null
    if (!isInRange(lat, lng)) return null
    return { lat, lng }
}

export function isValidLatLng(
    point: { lat: unknown; lng: unknown } | null | undefined
): point is LatLng {
    return normalizeLatLng(point) !== null
}