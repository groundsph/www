import { NextRequest, NextResponse } from "next/server"
import { checkSubscriptions } from "./check-subscriptions/logic"
import { updateHiddenGems } from "./hidden-gems/logic"
import { runLeaderboardSnapshots } from "./leaderboard-snapshots/logic"

/**
 * Unified Daily Cron Job
 *
 * This endpoint consolidates all daily cron jobs to prevent multiple
 * routes triggering at the same time.
 *
 * It runs the following jobs sequentially:
 * 1. Check expired subscriptions (cafe and supporter)
 * 2. Evaluate hidden gem cafes
 * 3. Snapshot monthly leaderboards
 *
 * Security: Requires CRON_SECRET to be passed in Authorization header
 *
 * @example
 * curl -X GET https://your-domain.com/api/cron/daily \
 *   -H "Authorization: Bearer your-cron-secret"
 */
export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
        console.error("[Daily Cron] CRON_SECRET not configured")
        return NextResponse.json(
            { error: "Server configuration error" },
            { status: 500 }
        )
    }

    // Support both "Bearer <token>" and plain token
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

    if (token !== cronSecret) {
        console.error("[Daily Cron] Invalid cron secret provided")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Daily Cron] Starting daily cron jobs...")

    const results: Record<string, unknown> = {}
    const errors: string[] = []

    // Run each job sequentially
    // This prevents race conditions and makes debugging easier

    try {
        console.log("[Daily Cron] Running check-subscriptions...")
        results.subscriptions = await checkSubscriptions()
        console.log("[Daily Cron] check-subscriptions completed")
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e)
        console.error("[Daily Cron] check-subscriptions failed:", errorMessage)
        results.subscriptions = { error: errorMessage }
        errors.push(`subscriptions: ${errorMessage}`)
    }

    try {
        console.log("[Daily Cron] Running hidden-gems...")
        results.hiddenGems = await updateHiddenGems()
        console.log("[Daily Cron] hidden-gems completed")
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e)
        console.error("[Daily Cron] hidden-gems failed:", errorMessage)
        results.hiddenGems = { error: errorMessage }
        errors.push(`hiddenGems: ${errorMessage}`)
    }

    try {
        console.log("[Daily Cron] Running leaderboard-snapshots...")
        results.leaderboard = await runLeaderboardSnapshots()
        console.log("[Daily Cron] leaderboard-snapshots completed")
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e)
        console.error("[Daily Cron] leaderboard-snapshots failed:", errorMessage)
        results.leaderboard = { error: errorMessage }
        errors.push(`leaderboard: ${errorMessage}`)
    }

    console.log("[Daily Cron] All jobs completed", {
        hasErrors: errors.length > 0,
        errorCount: errors.length,
    })

    if (errors.length > 0) {
        return NextResponse.json(
            {
                ok: true,
                partialSuccess: true,
                results,
                errors,
            },
            { status: 207 }
        ) // 207 Multi-Status
    }

    return NextResponse.json({ ok: true, results })
}
