import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { buildOsrmUrl } from "@/utils/map/osrm"

const coordinateSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
})

const routeRequestSchema = z.object({
    start: coordinateSchema,
    end: coordinateSchema,
    profile: z.enum(["driving", "foot"]).optional(),
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const parseResult = routeRequestSchema.safeParse(body)
        if (!parseResult.success) {
            return NextResponse.json(
                { success: false, error: "Invalid coordinates" },
                { status: 400 }
            )
        }

        const { start, end, profile } = parseResult.data
        const url = buildOsrmUrl(start, end, profile || "driving")

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
    } catch (error) {
        console.error("[API] OSRM route error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch route" },
            { status: 500 }
        )
    }
}
