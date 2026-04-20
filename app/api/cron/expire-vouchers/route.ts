import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { discountVouchers, discountCampaigns } from "@/db/schema"
import { eq, and, lt, sql } from "drizzle-orm"

/**
 * Expire Vouchers Cron Endpoint
 *
 * This endpoint expires discount campaigns and vouchers that have passed
 * their end date or expiry date.
 *
 * Security: Requires CRON_SECRET to be passed in Authorization header
 *
 * @example
 * curl -X POST https://your-domain.com/api/cron/expire-vouchers \
 *   -H "Authorization: Bearer your-cron-secret"
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const now = new Date()

        // Expire campaigns past their end date
        await db
            .update(discountCampaigns)
            .set({ status: "expired", updatedAt: now })
            .where(
                and(
                    eq(discountCampaigns.status, "active"),
                    lt(discountCampaigns.endDate, now)
                )
            )

        // Expire vouchers past their expiry
        await db
            .update(discountVouchers)
            .set({ status: "expired", updatedAt: now })
            .where(
                and(
                    sql`${discountVouchers.status} IN ('available', 'claimed')`,
                    lt(discountVouchers.expiresAt, now)
                )
            )

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[expire-vouchers] Error:", error)
        return NextResponse.json(
            { error: "Failed to expire vouchers" },
            { status: 500 }
        )
    }
}
