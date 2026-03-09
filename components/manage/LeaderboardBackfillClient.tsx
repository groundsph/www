"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { getLeaderboardSnapshotStatus, backfillLeaderboardSnapshots, backfillAllMissingLeaderboardSnapshots, deleteLeaderboardSnapshots } from "@/app/api/actions/admin"
import { RefreshCw, Loader2, Trophy, AlertCircle, CheckCircle2, Trash2, Play } from "lucide-react"

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

    const refresh = useCallback(async () => {
        setLoaded(false)
        const updated = await fetchStatus()
        setMonths(updated)
        setLoaded(true)
    }, [fetchStatus])

    if (!loaded) {
        return (
            <div className="bg-background border border-tertiary/50 rounded-xl p-16 shadow-sm">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-text opacity-40" />
            </div>
        )
    }

    const missingCount = months.filter(m => m.hasMissing).length
    const completeCount = months.filter(m => !m.hasMissing && (m.userCount > 0 || m.cafeCount > 0)).length

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-background shadow-sm rounded-xl p-4 border border-tertiary/50">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <span className="text-2xl font-bold">{months.length}</span>
                    </div>
                    <div className="text-text/60 text-sm">Total Months</div>
                </div>
                <div className="bg-background shadow-sm rounded-xl p-4 border border-tertiary/50">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-2xl font-bold">{completeCount}</span>
                    </div>
                    <div className="text-text/60 text-sm">Complete</div>
                </div>
                <div className="bg-background shadow-sm rounded-xl p-4 border border-tertiary/50">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <span className="text-2xl font-bold">{missingCount}</span>
                    </div>
                    <div className="text-text/60 text-sm">Missing</div>
                </div>
            </div>

            {/* Header with actions */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">Leaderboard Snapshots</h2>
                <div className="flex gap-2">
                    <button
                        onClick={refresh}
                        disabled={processing !== null}
                        className="flex items-center gap-2 px-4 py-2.5 bg-tertiary/30 hover:bg-tertiary/50 rounded-xl transition-all text-sm font-medium disabled:opacity-40"
                    >
                        <RefreshCw className={`w-4 h-4 ${processing !== null ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleBackfillAll}
                        disabled={processing !== null || missingCount === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm hover:shadow-md transition-all text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
                    >
                        {processing === "all" ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                Generate All Missing
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-background border border-tertiary/50 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-tertiary/50 text-left text-xs text-text/40 uppercase">
                            <th className="px-4 py-3 font-medium">Month</th>
                            <th className="px-4 py-3 font-medium text-right">User Rows</th>
                            <th className="px-4 py-3 font-medium text-right">Cafe Rows</th>
                            <th className="px-4 py-3 font-medium text-center">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {months.map((m) => (
                            <tr key={m.yearMonth} className="border-b border-tertiary/30 hover:bg-tertiary/10 transition">
                                <td className="px-4 py-3 font-medium">{m.yearMonth}</td>
                                <td className="px-4 py-3 text-right text-text/60">{m.userCount}</td>
                                <td className="px-4 py-3 text-right text-text/60">{m.cafeCount}</td>
                                <td className="px-4 py-3 text-center">
                                    {m.hasMissing ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">
                                            <AlertCircle className="w-3 h-3" />
                                            Missing
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Complete
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {m.hasMissing && (
                                            <button
                                                onClick={() => handleBackfillMonth(m.yearMonth)}
                                                disabled={processing !== null}
                                                className="px-3 py-1.5 bg-tertiary/30 hover:bg-tertiary rounded-lg text-sm font-medium transition disabled:opacity-50"
                                            >
                                                {processing === m.yearMonth ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    "Generate"
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDeleteTarget(m.yearMonth)}
                                            disabled={processing !== null || (m.userCount === 0 && m.cafeCount === 0)}
                                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                                            title={m.userCount === 0 && m.cafeCount === 0 ? "No snapshots to delete" : "Delete snapshots"}
                                        >
                                            {processing === m.yearMonth ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Delete confirmation dialog */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background rounded-xl p-6 space-y-4 max-w-sm w-full m-4 shadow-lg border border-tertiary/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/10 rounded-full">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <p className="font-semibold">Delete snapshots for {deleteTarget}?</p>
                        </div>
                        <p className="text-sm text-text/60">
                            This will delete all user and cafe snapshots for this month. This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 rounded-lg border border-tertiary/50 hover:bg-tertiary/30 transition text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteMonth(deleteTarget)}
                                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition text-sm font-medium"
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
