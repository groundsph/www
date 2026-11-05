import { describe, it, expect } from "bun:test"
import { buildChartSeries, maxViewsOf } from "@/utils/analytics/series"

const day = (date: string, views: number, uniqueVisitors = 1) => ({
    date,
    views,
    uniqueVisitors,
})

describe("buildChartSeries", () => {
    it("returns 7 daily points for a 7-day period", () => {
        const days = Array.from({ length: 7 }, (_, i) =>
            day(`2026-01-0${i + 1}`, 1)
        )
        const series = buildChartSeries(days, 7)
        expect(series.length).toBe(7)
        expect(series[0].views).toBe(1)
    })

    it("returns 30 daily points for a 30-day period", () => {
        const days = Array.from({ length: 30 }, (_, i) =>
            day(`2026-01-${String(i + 1).padStart(2, "0")}`, 2)
        )
        const series = buildChartSeries(days, 30)
        expect(series.length).toBe(30)
    })

    it("returns 13 weekly buckets for a 90-day period", () => {
        const days = Array.from({ length: 90 }, (_, i) =>
            day(`d${String(i).padStart(3, "0")}`, 1)
        )
        const series = buildChartSeries(days, 90)
        expect(series.length).toBe(13)
    })

    it("sums views within a weekly bucket", () => {
        const days = [
            day("d0", 1), day("d1", 2), day("d2", 3), day("d3", 4),
            day("d4", 5), day("d5", 6), day("d6", 7),
        ]
        const series = buildChartSeries(days, 90)
        expect(series.length).toBe(1)
        expect(series[0].views).toBe(28)
    })

    it("never returns more buckets than it was given days", () => {
        const series = buildChartSeries([day("d0", 4)], 90)
        expect(series.length).toBe(1)
        expect(series[0].views).toBe(4)
    })
})

describe("maxViewsOf", () => {
    it("returns the largest rendered value", () => {
        expect(maxViewsOf([{ label: "a", views: 3 }, { label: "b", views: 9 }])).toBe(9)
    })

    it("floors at 1 so an all-zero series does not divide by zero", () => {
        expect(maxViewsOf([{ label: "a", views: 0 }])).toBe(1)
        expect(maxViewsOf([])).toBe(1)
    })
})
