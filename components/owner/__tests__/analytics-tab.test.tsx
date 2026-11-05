import { describe, it, expect } from "bun:test"

/**
 * Source-scan guard, deliberately not a render test: `CafeManagement.tsx` is
 * ~2,300 lines long and mounting it to assert the analytics chart wiring is
 * disproportionate. The pure series maths is covered by
 * `utils/analytics/__tests__/series.test.ts`; render-level proof of the chart
 * lands in the E2E phase.
 *
 * `Math.min(` is safe to scan for file-wide: the only occurrence in the
 * component is the chart's `slice(-Math.min(analyticsPeriod, 30))` truncation,
 * which is exactly the defect this guard pins.
 */
const source = await Bun.file("components/owner/CafeManagement.tsx").text()

describe("analytics chart wiring", () => {
    it("no longer truncates the series to 30 points", () => {
        expect(source).not.toContain("Math.min(")
    })

    it("builds the series with the shared helper", () => {
        expect(source).toContain("buildChartSeries")
        expect(source).toContain("maxViewsOf")
    })

    it("labels the 90-day view as weekly", () => {
        expect(source.toLowerCase()).toContain("per week")
    })
})

describe("analytics CSV export button", () => {
    it("offers a Download CSV control", () => {
        expect(source).toContain("Download CSV")
    })

    it("calls the export action", () => {
        expect(source).toContain("exportCafeAnalyticsCSV")
    })

    it("surfaces a failure instead of failing silently", () => {
        expect(source).toContain("Failed to export analytics")
    })
})
