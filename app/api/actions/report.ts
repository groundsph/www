"use server"

import { db } from "@/db"
import { cafeReports, cafes } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export type ReportReason = "permanently_closed" | "does_not_exist" | "other"

interface SubmitReportResponse {
    success: boolean
    message?: string
    error?: string
}

const HIDE_THRESHOLD = 5

export async function submitCafeReport(
    cafeId: string,
    reason: ReportReason,
    details?: string
): Promise<SubmitReportResponse> {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })
        const user = session?.user

        if (!user) {
            return { success: false, error: "You must be logged in to report a cafe." }
        }

        // Check if user has already reported this cafe
        const existingReport = await db.query.cafeReports.findFirst({
            where: and(
                eq(cafeReports.cafeId, cafeId),
                eq(cafeReports.userId, user.id)
            ),
        })

        if (existingReport) {
            return { success: false, error: "You have already reported this cafe." }
        }

        // Create the report
        await db.insert(cafeReports).values({
            cafeId,
            userId: user.id,
            reason,
            details,
        })

        // Check threshold for "permanently_closed" or "does_not_exist"
        if (reason === "permanently_closed" || reason === "does_not_exist") {
            // Count unique reports for this cafe with these reasons
            const reportCountResult = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(cafeReports)
                .where(
                    and(
                        eq(cafeReports.cafeId, cafeId),
                        sql`${cafeReports.reason} IN ('permanently_closed', 'does_not_exist')`
                    )
                )

            const reportCount = reportCountResult[0]?.count ?? 0

            if (reportCount >= HIDE_THRESHOLD) {
                // Auto-hide the cafe
                await db
                    .update(cafes)
                    .set({ isPublished: false })
                    .where(eq(cafes.id, cafeId))

                // Ideally, notify admins here (omitted for now)
            }
        }

        revalidatePath(`/cafe/${cafeId}`)
        return { success: true, message: "Report submitted successfully." }
    } catch (error) {
        console.error("Error submitting report:", error)
        return { success: false, error: "Failed to submit report. Please try again." }
    }
}
