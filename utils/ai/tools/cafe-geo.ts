/**
 * Geo utilities for cafe queries
 * Distance calculations, clustering, and sorting
 */

export interface GeoPoint {
    lat: number
    lng: number
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = toRadians(b.lat - a.lat)
    const dLng = toRadians(b.lng - a.lng)

    const lat1 = toRadians(a.lat)
    const lat2 = toRadians(b.lat)

    const sinDLat = Math.sin(dLat / 2)
    const sinDLng = Math.sin(dLng / 2)

    const c =
        2 *
        Math.asin(
            Math.sqrt(
                sinDLat * sinDLat +
                    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
            )
        )

    return R * c
}

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180
}

export interface CafeWithLocation {
    id: string
    lat: number | null
    lng: number | null
    [key: string]: unknown
}

/**
 * Sort cafes by distance from an origin point
 */
export function sortByDistance<T extends CafeWithLocation>(
    cafes: T[],
    origin: GeoPoint
): T[] {
    return [...cafes].sort((a, b) => {
        const distA = calculateDistanceOrInfinity(a, origin)
        const distB = calculateDistanceOrInfinity(b, origin)
        return distA - distB
    })
}

function calculateDistanceOrInfinity(
    cafe: CafeWithLocation,
    origin: GeoPoint
): number {
    if (cafe.lat == null || cafe.lng == null) return Infinity
    return haversineKm({ lat: cafe.lat, lng: cafe.lng }, origin)
}

export interface ClusterResult<T> {
    clusters: T[][]
    unclustered: T[]
}

/**
 * Cluster cafes by proximity (group nearby cafes together)
 * Uses a greedy approach: starts with first cafe, adds all cafes within maxDistanceKm
 * Then repeats with remaining unclustered cafes
 *
 * @param cafes - Array of cafes to cluster
 * @param maxDistanceKm - Maximum distance between cafes in same cluster
 * @param targetCount - Target number of cafes per cluster (stops adding after this)
 */
export function clusterByProximity<T extends CafeWithLocation>(
    cafes: T[],
    maxDistanceKm: number,
    targetCount: number
): ClusterResult<T> {
    const clusters: T[][] = []
    const unclustered: T[] = []
    const processed = new Set<string>()

    for (const cafe of cafes) {
        if (processed.has(cafe.id) || cafe.lat == null || cafe.lng == null) {
            if (cafe.lat == null || cafe.lng == null) {
                unclustered.push(cafe)
            }
            continue
        }

        const cluster: T[] = [cafe]
        processed.add(cafe.id)

        const center = { lat: cafe.lat, lng: cafe.lng }

        for (const other of cafes) {
            if (cluster.length >= targetCount) break
            if (processed.has(other.id)) continue
            if (other.lat == null || other.lng == null) continue

            const otherPoint = { lat: other.lat, lng: other.lng }
            const distance = haversineKm(center, otherPoint)

            if (distance <= maxDistanceKm) {
                cluster.push(other)
                processed.add(other.id)
            }
        }

        clusters.push(cluster)
    }

    return { clusters, unclustered }
}

/**
 * Filter cafes by distance from a center point
 */
export function filterByDistance<T extends CafeWithLocation>(
    cafes: T[],
    center: GeoPoint,
    maxDistanceKm: number
): T[] {
    return cafes.filter((cafe) => {
        if (cafe.lat == null || cafe.lng == null) return false
        const distance = haversineKm({ lat: cafe.lat, lng: cafe.lng }, center)
        return distance <= maxDistanceKm
    })
}

/**
 * Add distance property to cafes
 */
export function addDistanceToCafes<T extends CafeWithLocation>(
    cafes: T[],
    origin: GeoPoint
): Array<T & { distanceKm: number }> {
    return cafes.map((cafe) => ({
        ...cafe,
        distanceKm: calculateDistanceOrInfinity(cafe, origin),
    }))
}
