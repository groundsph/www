import { db } from "@/db"
import { discountCampaigns, discountVouchers } from "@/db/schema"
import { eq, and, lt, sql } from "drizzle-orm"

export interface ExpireVouchersResult {
    success: boolean
    campaigns: {
        expired: number
    }
    vouchers: {
        expired: number
    }
    errors?: string[]
}

/**
 * Expire discount campaigns and vouchers that have passed their end date
 * Returns a result object with counts and any errors
 */
export async function expireVouchers(): Promise<ExpireVouchersResult> {
    const now = new Date()
    const errors: string[] = []

    let expiredCampaignsCount = 0
    let expiredVouchersCount = 0

    try {
        // Expire campaigns past their end date
        const expiredCampaigns = await db
            .update(discountCampaigns)
            .set({ status: "expired", updatedAt: now })
            .where(
                and(
                    eq(discountCampaigns.status, "active"),
                    lt(discountCampaigns.endDate, now)
                )
            )
            .returning({ id: discountCampaigns.id })

        expiredCampaignsCount = expiredCampaigns.length

        if (expiredCampaignsCount > 0) {
            console.log(`[expire-vouchers] Expired ${expiredCampaignsCount} campaign(s)`)
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        errors.push(`Campaigns: ${errorMessage}`)
        console.error("[expire-vouchers] Error expiring campaigns:", err)
    }

    try {
        // Expire vouchers past their expiry
        const expiredVouchers = await db
            .update(discountVouchers)
            .set({ status: "expired", updatedAt: now })
            .where(
                and(
                    sql`${discountVouchers.status} IN ('available', 'claimed')`,
                    lt(discountVouchers.expiresAt, now)
                )
            )
            .returning({ id: discountVouchers.id })

        expiredVouchersCount = expiredVouchers.length

        if (expiredVouchersCount > 0) {
            console.log(`[expire-vouchers] Expired ${expiredVouchersCount} voucher(s)`)
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        errors.push(`Vouchers: ${errorMessage}`)
        console.error("[expire-vouchers] Error expiring vouchers:", err)
    }

    return {
        success: true,
        campaigns: {
            expired: expiredCampaignsCount,
        },
        vouchers: {
            expired: expiredVouchersCount,
        },
        errors: errors.length > 0 ? errors : undefined,
    }
}
