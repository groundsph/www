export type OsrmProfile = "driving" | "foot"
export type OsrmTableAnnotation = "duration" | "distance"

function formatCoords(points: { lat: number; lng: number }[]) {
    return points.map((p) => `${p.lng},${p.lat}`).join(";")
}

export function buildOsrmTableUrl(
    points: { lat: number; lng: number }[],
    profile: OsrmProfile = "foot",
    annotations: OsrmTableAnnotation = "duration"
) {
    const coords = formatCoords(points)
    return `https://router.project-osrm.org/table/v1/${profile}/${coords}?annotations=${annotations}`
}

export function buildOsrmUrl(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    profile: OsrmProfile = "driving"
) {
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`
    return `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=false`
}
