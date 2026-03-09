import { NextRequest, NextResponse } from 'next/server'
import { evaluateHiddenGems } from '@/app/api/actions/hidden-gems'

/**
 * Cron Job: Evaluate Hidden Gem Cafes
 *
 * @deprecated Use `/api/cron/daily` instead. This route is kept for backward compatibility.
 *
 * This endpoint should be called daily by Dokploy or any cron service.
 * It evaluates all hidden gem cafes based on the previous calendar month's
 * unique visitor count and graduates those exceeding the threshold.
 *
 * The job is idempotent - safe to run multiple times per month.
 * First run of each month performs evaluation; subsequent runs are no-ops.
 *
 * Security: Requires CRON_SECRET to be passed in Authorization header
 *
 * @example
 * curl -X GET https://your-domain.com/api/cron/hidden-gems \
 *   -H "Authorization: Bearer your-cron-secret"
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret) {
            console.error('[Hidden Gems Cron] CRON_SECRET not configured')
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        // Support both "Bearer <token>" and plain token
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader

        if (token !== cronSecret) {
            console.error('[Hidden Gems Cron] Invalid cron secret provided')
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        console.log('[Hidden Gems Cron] Starting evaluation...')

        // Run the evaluation
        const report = await evaluateHiddenGems()

        console.log(`[Hidden Gems Cron] Evaluation complete:`, {
            period: report.period,
            evaluated: report.cafesEvaluated,
            graduated: report.cafesGraduated,
        })

        // Log graduated cafes for visibility
        if (report.cafesGraduated > 0) {
            const graduatedCafes = report.results
                .filter(r => r.graduated)
                .map(r => `${r.cafeName} (${r.uniqueVisitors} visitors)`)
            console.log('[Hidden Gems Cron] Graduated cafes:', graduatedCafes)
        }

        return NextResponse.json({
            success: true,
            message: report.cafesEvaluated === 0
                ? `No hidden gems to evaluate for period ${report.period} (already processed or none exist)`
                : `Evaluated ${report.cafesEvaluated} hidden gem(s), graduated ${report.cafesGraduated}`,
            report: {
                period: report.period,
                threshold: report.threshold,
                dateRange: {
                    start: report.startDate,
                    end: report.endDate,
                },
                summary: {
                    cafesEvaluated: report.cafesEvaluated,
                    cafesGraduated: report.cafesGraduated,
                },
                results: report.results,
            }
        })

    } catch (error) {
        console.error('[Hidden Gems Cron] Error:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
