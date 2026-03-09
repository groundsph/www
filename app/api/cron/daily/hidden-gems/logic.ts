import { evaluateHiddenGems } from "@/app/api/actions/hidden-gems"

export interface HiddenGemsResult {
    success: boolean
    message: string
    report: {
        period: string
        threshold: number
        dateRange: {
            start: string
            end: string
        }
        summary: {
            cafesEvaluated: number
            cafesGraduated: number
        }
        results: unknown[]
    }
}

/**
 * Evaluate hidden gem cafes based on previous month's visitor count
 * Returns a report with period details and graduation results
 */
export async function updateHiddenGems(): Promise<HiddenGemsResult> {
    console.log("[Hidden Gems Cron] Starting evaluation...")

    // Run the evaluation
    const report = await evaluateHiddenGems()

    console.log("[Hidden Gems Cron] Evaluation complete:", {
        period: report.period,
        evaluated: report.cafesEvaluated,
        graduated: report.cafesGraduated,
    })

    // Log graduated cafes for visibility
    if (report.cafesGraduated > 0) {
        const graduatedCafes = report.results
            .filter((r) => r.graduated)
            .map((r) => `${r.cafeName} (${r.uniqueVisitors} visitors)`)
        console.log("[Hidden Gems Cron] Graduated cafes:", graduatedCafes)
    }

    return {
        success: true,
        message:
            report.cafesEvaluated === 0
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
        },
    }
}
