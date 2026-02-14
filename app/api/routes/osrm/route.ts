import { NextRequest, NextResponse } from "next/server"
import { buildOsrmUrl, type OsrmProfile } from "@/utils/map/osrm"

export async function POST(request: NextRequest) {
    const body = await request.json()
    const profile: OsrmProfile = body.profile || "driving"
    const { start, end } = body
    if (!start || !end) {
        return NextResponse.json({ success: false, error: "Missing coordinates" }, { status: 400 })
    }

    const url = buildOsrmUrl(start, end, profile)
    const response = await fetch(url)
    const data = await response.json()

    if (!data?.routes?.[0]?.geometry) {
        return NextResponse.json({ success: false, error: "No route" }, { status: 404 })
    }

    return NextResponse.json({
        success: true,
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance,
        duration: data.routes[0].duration,
    })
}
