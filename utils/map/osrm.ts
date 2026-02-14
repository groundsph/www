export type OsrmProfile = "driving" | "foot"

export function buildOsrmUrl(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    profile: OsrmProfile = "driving"
) {
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`
    return `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=false`
}
