import { buildOsrmTableUrl, type OsrmProfile } from "@/utils/map/osrm"
import { solveTspExact } from "@/utils/crawls/tsp-solver"
import { isOpenAt, nextOpenWindow } from "@/utils/crawls/opening-hours"
import type { OperatingHours } from "@/utils/types/cafe"

interface RouteCafe {
    id: string
    name: string
    slug: string
    lat: number | null
    lng: number | null
    operatingHours?: OperatingHours | null
}

interface RoutePlanOptions {
    startDay: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
    startTime: string
    travelMode?: OsrmProfile
    dwellMinutes?: number
}

interface ScheduleEntry {
    cafeId: string
    arrivalDay: string
    arrivalTime: string
    note: string
}

interface RoutePlanResult {
    ordered: RouteCafe[]
    reason: string
    schedule: ScheduleEntry[]
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

type DayOfWeek = typeof DAYS[number]

function toMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number)
    return h * 60 + m
}

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24
    const m = Math.floor(minutes % 60)
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function getNextDay(day: DayOfWeek): DayOfWeek {
    const idx = DAYS.indexOf(day)
    return DAYS[(idx + 1) % 7]
}

function euclideanDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const dx = a.lat - b.lat
    const dy = a.lng - b.lng
    return Math.hypot(dx, dy)
}

function centroid(cafes: { lat: number; lng: number }[]) {
    if (cafes.length === 0) return null
    const lat = cafes.reduce((sum, c) => sum + c.lat, 0) / cafes.length
    const lng = cafes.reduce((sum, c) => sum + c.lng, 0) / cafes.length
    return { lat, lng }
}

function nearestNeighborOrder(
    cafes: RouteCafe[],
    startIndex: number,
    distanceFn: (a: number, b: number) => number
): number[] {
    const n = cafes.length
    if (n === 0) return []
    if (n === 1) return [0]

    const visited = new Set<number>()
    const order: number[] = [startIndex]
    visited.add(startIndex)

    while (order.length < n) {
        const current = order[order.length - 1]
        let bestNext = -1
        let bestDist = Number.POSITIVE_INFINITY

        for (let i = 0; i < n; i++) {
            if (visited.has(i)) continue
            const dist = distanceFn(current, i)
            if (dist < bestDist) {
                bestDist = dist
                bestNext = i
            }
        }

        if (bestNext === -1) break
        order.push(bestNext)
        visited.add(bestNext)
    }

    return order
}

async function fetchOsrmTable(points: { lat: number; lng: number }[], profile: OsrmProfile): Promise<number[][] | null> {
    try {
        const url = buildOsrmTableUrl(points, profile, "duration")
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
        if (!response.ok) return null

        const data = await response.json()
        if (!data.durations || !Array.isArray(data.durations)) return null

        return (data.durations as number[][]).map((row) =>
            row.map((seconds) => Math.ceil(seconds / 60))
        )
    } catch {
        return null
    }
}

function fallbackEuclideanDistanceMatrix(cafes: { lat: number; lng: number }[]): number[][] {
    const n = cafes.length
    const matrix: number[][] = Array(n)
        .fill(null)
        .map(() => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i !== j) {
                const dist = euclideanDistance(cafes[i], cafes[j])
                matrix[i][j] = Math.max(1, Math.round(dist * 10000))
            }
        }
    }

    return matrix
}

function findCentroidStartIndex(cafes: { lat: number; lng: number }[]): number {
    const center = centroid(cafes)
    if (!center) return 0

    let bestIdx = 0
    let bestDist = euclideanDistance(center, cafes[0])

    for (let i = 1; i < cafes.length; i++) {
        const dist = euclideanDistance(center, cafes[i])
        if (dist < bestDist) {
            bestDist = dist
            bestIdx = i
        }
    }

    return bestIdx
}

function generateReason(travelMode: OsrmProfile, useExactTsp: boolean, cafeCount: number): string {
    const modeStr = travelMode === "foot" ? "walking" : "driving"
    const tspStr = useExactTsp ? "optimal" : "efficient"

    if (cafeCount <= 3) {
        return `Ordered for a short ${modeStr} route using ${tspStr} pathfinding.`
    } else if (cafeCount <= 6) {
        return `Arranged for minimal ${modeStr} time between stops using ${tspStr} routing.`
    } else {
        return `Plotted as a practical ${modeStr} route to minimize travel using ${tspStr} path optimization.`
    }
}

export async function buildRoutePlan(
    cafes: RouteCafe[],
    options: RoutePlanOptions
): Promise<RoutePlanResult> {
    const { startDay, startTime, travelMode = "foot", dwellMinutes = 45 } = options

    const validCafes = cafes.filter((c) => c.lat != null && c.lng != null)

    if (validCafes.length === 0) {
        return {
            ordered: [],
            reason: "No valid cafes with locations found.",
            schedule: [],
        }
    }

    if (validCafes.length === 1) {
        return {
            ordered: validCafes,
            reason: "Just one stop—easy to find!",
            schedule: [{
                cafeId: validCafes[0].id,
                arrivalDay: startDay,
                arrivalTime: startTime,
                note: `Visit around ${startTime}`,
            }],
        }
    }

    if (validCafes.length === 2) {
        const schedule = buildSchedule(validCafes, [0, 1], startDay, startTime, dwellMinutes)
        return {
            ordered: validCafes,
            reason: `Two stops, ordered for a quick ${travelMode === "foot" ? "walking" : "driving"} route.`,
            schedule,
        }
    }

    const coords = validCafes.map((c) => ({ lat: c.lat!, lng: c.lng! }))
    let durationMatrix: number[][] | null = null
    let useExactTsp = false

    if (validCafes.length <= 10) {
        durationMatrix = await fetchOsrmTable(coords, travelMode)
    }

    let orderIndices: number[]

    if (durationMatrix) {
        useExactTsp = true
        const startIndex = findCentroidStartIndex(coords)
        orderIndices = solveTspExact(durationMatrix, startIndex)
    } else {
        durationMatrix = fallbackEuclideanDistanceMatrix(coords)
        const startIndex = findCentroidStartIndex(coords)

        if (validCafes.length <= 10) {
            orderIndices = solveTspExact(durationMatrix, startIndex)
            useExactTsp = true
        } else {
            orderIndices = nearestNeighborOrder(
                validCafes,
                startIndex,
                (a, b) => durationMatrix![a][b]
            )
        }
    }

    const ordered = orderIndices.map((i) => validCafes[i])
    const schedule = buildSchedule(ordered, orderIndices, startDay, startTime, dwellMinutes)

    return {
        ordered,
        reason: generateReason(travelMode, useExactTsp, validCafes.length),
        schedule,
    }
}

function buildSchedule(
    cafes: RouteCafe[],
    orderIndices: number[],
    startDay: DayOfWeek,
    startTime: string,
    dwellMinutes: number
): ScheduleEntry[] {
    const schedule: ScheduleEntry[] = []
    let currentDay: DayOfWeek = startDay
    let currentMinutes = toMinutes(startTime)

    for (let i = 0; i < cafes.length; i++) {
        const cafe = cafes[i]
        const arrivalTime = formatTime(currentMinutes)
        const hours = cafe.operatingHours

        let note: string

        if (hours && hours.length > 0) {
            if (isOpenAt(hours, currentDay, arrivalTime)) {
                note = `Visit around ${arrivalTime}`
            } else {
                const nextWindow = nextOpenWindow(hours, currentDay, arrivalTime)
                if (nextWindow) {
                    const adjustedTime = nextWindow.open
                    const adjustedMinutes = toMinutes(adjustedTime)
                    note = `Visit around ${adjustedTime} (opens then)`
                    currentMinutes = adjustedMinutes
                } else {
                    note = "Closed at planned time"
                }
            }
        } else {
            note = `Visit around ${arrivalTime}`
        }

        schedule.push({
            cafeId: cafe.id,
            arrivalDay: currentDay,
            arrivalTime: formatTime(currentMinutes),
            note,
        })

        if (i < cafes.length - 1) {
            currentMinutes += dwellMinutes
            if (currentMinutes >= 24 * 60) {
                currentMinutes -= 24 * 60
                currentDay = getNextDay(currentDay)
            }
        }
    }

    return schedule
}
