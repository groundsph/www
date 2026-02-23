interface RouteCafe {
    id: string
    name: string
    slug: string
    lat: number | null
    lng: number | null
    rating?: number | null
}

function distance(a: RouteCafe, b: RouteCafe): number {
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Number.POSITIVE_INFINITY
    const dx = a.lat - b.lat
    const dy = a.lng - b.lng
    return Math.hypot(dx, dy)
}

function centroid(cafes: RouteCafe[]) {
    const points = cafes.filter((c) => c.lat != null && c.lng != null)
    if (points.length === 0) return null
    const lat = points.reduce((sum, c) => sum + (c.lat ?? 0), 0) / points.length
    const lng = points.reduce((sum, c) => sum + (c.lng ?? 0), 0) / points.length
    return { lat, lng }
}

export function buildRoutePlan(cafes: RouteCafe[]) {
    if (cafes.length <= 2) {
        return {
            ordered: cafes,
            reason: "With only a couple of stops, the order follows the original listing.",
        }
    }

    const center = centroid(cafes)
    const start = center
        ? cafes
              .filter((c) => c.lat != null && c.lng != null)
              .sort((a, b) => distance({ ...a, ...center } as RouteCafe, a) - distance({ ...a, ...center } as RouteCafe, b))[0]
        : cafes[0]

    const remaining = cafes.filter((c) => c.id !== start.id)
    const ordered = [start]

    while (remaining.length > 0) {
        const last = ordered[ordered.length - 1]
        remaining.sort((a, b) => distance(last, a) - distance(last, b))
        ordered.push(remaining.shift()!)
    }

    return {
        ordered,
        reason: "Started near the route centroid and chose the nearest next stop to keep the path walkable.",
    }
}
