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

        const response = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "Grounds.ph/1.0",
            },
        })

        if (!response.ok) {
            const text = await response.text()
            console.error("[API] OSRM HTTP error:", response.status, text.slice(0, 200))
            return NextResponse.json(
                { success: false, error: `OSRM API error: ${response.status}` },
                { status: 502 }
            )
        }

        const contentType = response.headers.get("content-type")
        if (!contentType?.includes("application/json")) {
            const text = await response.text()
            console.error("[API] OSRM non-JSON response:", text.slice(0, 200))
            return NextResponse.json(
                { success: false, error: "Invalid response from routing service" },
                { status: 502 }
            )
        }

        const data = await response.json()

        if (!data?.routes?.[0]?.geometry) {
            console.error("[API] OSRM no route in response:", JSON.stringify(data).slice(0, 200))
            return NextResponse.json({ success: false, error: "No route found" }, { status: 404 })
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
