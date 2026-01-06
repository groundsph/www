import { CafeWithRatings } from "./types/extra"

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @returns Distance in kilometers
 */
export function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371 // Earth's radius in km
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180)
}

/**
 * Filter cafes within a given radius from user's location
 * @returns Cafes sorted by distance (closest first)
 */
export function getNearbyCafes(
    cafes: CafeWithRatings[],
    userLat: number,
    userLng: number,
    radiusKm: number = 10
): Array<CafeWithRatings & { distance: number }> {
    const cafesWithDistance = cafes
        .filter(cafe => cafe.lat != null && cafe.lng != null)
        .map(cafe => ({
            ...cafe,
            distance: haversineDistance(userLat, userLng, cafe.lat!, cafe.lng!)
        }))
        .filter(cafe => cafe.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance)

    return cafesWithDistance
}

/**
 * Pick a random cafe from a list
 */
export function pickRandomCafe<T>(cafes: T[]): T | null {
    if (cafes.length === 0) return null
    const randomIndex = Math.floor(Math.random() * cafes.length)
    return cafes[randomIndex]
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
    if (km < 1) {
        return `${Math.round(km * 1000)}m`
    }
    return `${km.toFixed(1)}km`
}
