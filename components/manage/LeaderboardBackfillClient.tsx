"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { getLeaderboardSnapshotStatus, backfillLeaderboardSnapshots, backfillAllMissingLeaderboardSnapshots, deleteLeaderboardSnapshots } from "@/app/api/actions/admin"

interface MonthStatus {
    yearMonth: string
    userCount: number
    cafeCount: number
    hasMissing: boolean
}

function getLast24Months(): string[] {
    const months: string[] = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }
    return months
}

export function LeaderboardBackfillClient() {
    const [months, setMonths] = useState<MonthStatus[]>([])
    const [loaded, setLoaded] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | "all" | null>(null)

    const monthList = useMemo(() => getLast24Months(), [])

    const fetchStatus = useCallback(async () => {
        const result = await getLeaderboardSnapshotStatus(monthList)
        return result.success && result.data ? result.data : []
    }, [monthList])

    useEffect(() => {
        let cancelled = false
        if (!loaded) {
            fetchStatus().then((data) => {
                if (!cancelled) {
                    setMonths(data)
                    setLoaded(true)
                }
            })
        }
        return () => { cancelled = true }
    }, [fetchStatus, loaded])

    const handleBackfillMonth = useCallback(async (yearMonth: string) => {
        setProcessing(yearMonth)
        await backfillLeaderboardSnapshots(yearMonth)
        const updated = await fetchStatus()
        setMonths(updated)
        setProcessing(null)
    }, [fetchStatus])

    const handleDeleteMonth = useCallback(async (yearMonth: string) => {
        setProcessing(yearMonth)
        await deleteLeaderboardSnapshots(yearMonth)
        setDeleteTarget(null)
        const updated = await fetchStatus()
        setMonths(updated)
        setProcessing(null)
    }, [fetchStatus])

    const handleBackfillAll = useCallback(async () => {
        setProcessing("all")
        const missing = months.filter((m) => m.hasMissing).map((m) => m.yearMonth)
        await backfillAllMissingLeaderboardSnapshots(missing)
        const updated = await fetchStatus()
        setMonths(updated)
        setProcessing(null)
    }, [months, fetchStatus])

    if (!loaded) return <div>Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Leaderboard Snapshots</h2>
                <button
                    onClick={handleBackfillAll}
                    disabled={processing !== null}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                    {processing === "all" ? "Processing..." : "Generate All Missing"}
                </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-muted">
                        <tr>
                            <th className="px-4 py-2 text-left">Month</th>
                            <th className="px-4 py-2 text-right">User Rows</th>
                            <th className="px-4 py-2 text-right">Cafe Rows</th>
                            <th className="px-4 py-2 text-center">Status</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {months.map((m) => (
                            <tr key={m.yearMonth} className="border-t">
                                <td className="px-4 py-3">{m.yearMonth}</td>
                                <td className="px-4 py-3 text-right">{m.userCount}</td>
                                <td className="px-4 py-3 text-right">{m.cafeCount}</td>
                                <td className="px-4 py-3 text-center">
                                    {m.hasMissing ? (
                                        <span className="text-destructive text-sm">Missing</span>
                                    ) : (
                                        <span className="text-green-600 text-sm">Complete</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    {m.hasMissing && (
                                        <button
                                            onClick={() => handleBackfillMonth(m.yearMonth)}
                                            disabled={processing !== null}
                                            className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
                                        >
                                            {processing === m.yearMonth ? "..." : "Generate"}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setDeleteTarget(m.yearMonth)}
                                        disabled={processing !== null || (m.userCount === 0 && m.cafeCount === 0)}
                                        className="px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm disabled:opacity-50"
                                    >
                                        {processing === m.yearMonth ? "..." : "Delete"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Delete confirmation dialog */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background rounded-xl p-6 space-y-4 max-w-sm w-full m-4">
                        <p className="font-semibold">Delete snapshots for {deleteTarget}?</p>
                        <p className="text-sm text-muted-foreground">
                            This will delete all user and cafe snapshots for this month. This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 rounded-md border"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteMonth(deleteTarget)}
                                className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}