export type AnalyticsPeriod = 7 | 30 | 90

export interface ChartPoint {
    label: string
    views: number
}

const WEEK_LENGTH = 7
const MAX_WEEKS = 13

/**
 * Shape `viewsByDay` into the series the chart actually draws.
 *
 * 7 and 30 render one bar per day. 90 would be sub-pixel at chart width, so it
 * is bucketed into weeks — 13 bars, which represents the full selected range
 * honestly instead of silently showing the last 30 days.
 *
 * Only `views` is aggregated. `uniqueVisitors` is deliberately not carried
 * into buckets: a visitor active on three days inside one week would be
 * counted three times. Anything needing true uniques stays daily (the CSV).
 */
export function buildChartSeries(
    viewsByDay: Array<{ date: string; views: number }>,
    period: AnalyticsPeriod
): ChartPoint[] {
    const daily: ChartPoint[] = viewsByDay.map((d) => ({
        label: d.date,
        views: d.views,
    }))

    if (period !== 90) {
        return daily.slice(-period)
    }

    const buckets: ChartPoint[] = []
    for (let end = daily.length; end > 0; end -= WEEK_LENGTH) {
        const start = Math.max(0, end - WEEK_LENGTH)
        const week = daily.slice(start, end)
        buckets.unshift({
            label: week[0].label,
            views: week.reduce((sum, point) => sum + point.views, 0),
        })
    }

    return buckets.slice(-MAX_WEEKS)
}

export function maxViewsOf(series: ChartPoint[]): number {
    if (series.length === 0) return 1
    return Math.max(...series.map((point) => point.views), 1)
}
