import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { cafePageViews } from "@/db/schema"

/**
 * POST /api/analytics/page-view
 * 
 * Records a cafe page view for analytics.
 * Called from client-side analytics.ts
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { cafeId, visitorId, deviceType, referrer } = body

        if (!cafeId) {
            return NextResponse.json(
                { success: false, error: "cafeId required" },
                { status: 400 }
            )
        }

        await db.insert(cafePageViews).values({
            cafeId,
            visitorId: visitorId || null,
            deviceType: deviceType || null,
            referrer: referrer || null,
            viewedAt: new Date(),
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Analytics page view error:", error)
        // Silently succeed - analytics shouldn't break the page
        return NextResponse.json({ success: true })
    }
}
