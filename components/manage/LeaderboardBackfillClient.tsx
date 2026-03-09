"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { getLeaderboardSnapshotStatus, backfillLeaderboardSnapshots, backfillAllMissingLeaderboardSnapshots, deleteLeaderboardSnapshots } from "@/app/api/actions/admin"
import { RefreshCw, Loader2, Trophy, AlertCircle, CheckCircle2, Trash2, Play, RotateCcw, Info, X } from "lucide-react"

interface MonthStatus {
    yearMonth: string
    userCount: number
    cafeCount: number
    hasMissing: boolean
}

interface BackfillResult {
    success: boolean
    message: string
    userCount?: number
    cafeCount?: number
    warnings?: string[]
}

function getMonthsFromLaunch(): string[] {
    const months: string[] = []
    // Grounds.ph started December 2025
    const startDate = new Date(2025, 11, 1) // December 2025
    const now = new Date()
    
    const current = new Date(now.getFullYear(), now.getMonth(), 1)
    
    while (current >= startDate) {
        months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`)
        current.setMonth(current.getMonth() - 1)
    }
    
    return months
}

export function LeaderboardBackfillClient() {
    const [months, setMonths] = useState<MonthStatus[]>([])
    const [loaded, setLoaded] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
    const [processing, setProcessing] = useState<string | "all" | null>(null)
    const [forceMode, setForceMode] = useState(false)
    const [result, setResult] = useState<BackfillResult | null>(null)

    const monthList = useMemo(() => getMonthsFromLaunch(), [])

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
        setResult(null)
        const res = await backfillLeaderboardSnapshots(yearMonth, { force: forceMode })
        setResult(res)
        const updated = await fetchStatus()
        setMonths(updated)
        setProcessing(null)
    }, [fetchStatus, forceMode])

    const handleDeleteMonth = useCallback(async (yearMonth: string) => {
        setProcessing(yearMonth)
        setResult(null)
        const res = await deleteLeaderboardSnapshots(yearMonth)
        setResult(res)
        setDeleteTarget(null)
        const updated = await fetchStatus()
        setMonths(updated)
        setProcessing(null)
    }, [fetchStatus])

    const handleBackfillAll = useCallback(async () => {
        setProcessing("all")
        setResult(null)
        const missing = months.filter((m) => m.hasMissing).map((m) => m.yearMonth)
        const res = await backfillAllMissingLeaderboardSnapshots(missing)
        setResult(res)
        const updated = await fetchStatus()
        setMonths(updated)
        setProcessing(null)
    }, [months, fetchStatus])

    const refresh = useCallback(async () => {
        setLoaded(false)
        setResult(null)
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
            {/* Result notification */}
            {result && (
                <div className={`rounded-xl p-4 border ${result.success ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex items-start gap-3">
                        {result.success ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                            <p className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                                {result.message}
                            </p>
                            {result.warnings && result.warnings.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {result.warnings.map((warning, i) => (
                                        <p key={i} className="text-sm text-amber-600 flex items-center gap-1">
                                            <Info className="w-3.5 h-3.5" />
                                            {warning}
                                        </p>
                                    ))}
                                </div>
                            )}
                            {(result.userCount !== undefined || result.cafeCount !== undefined) && (
                                <p className="text-sm text-text/60 mt-2">
                                    {result.userCount !== undefined && `${result.userCount} user rows `}
                                    {result.cafeCount !== undefined && `${result.cafeCount} cafe rows`}
                                </p>
                            )}
                        </div>
                        <button 
                            onClick={() => setResult(null)}
                            className="p-1 hover:bg-text/10 rounded-lg transition"
                        >
                            <X className="w-4 h-4 text-text/40" />
                        </button>
                    </div>
                </div>
            )}

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-text">Leaderboard Snapshots</h2>
                    <p className="text-sm text-text/60 mt-0.5">
                        {forceMode ? "Force mode: Will overwrite existing data" : "Smart mode: Only fills missing regions"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-3 py-2 bg-tertiary/20 rounded-lg cursor-pointer hover:bg-tertiary/30 transition">
                        <input
                            type="checkbox"
                            checked={forceMode}
                            onChange={(e) => setForceMode(e.target.checked)}
                            className="w-4 h-4 rounded border-tertiary/50"
                        />
                        <span className="text-sm font-medium">Force refresh</span>
                        <RotateCcw className={`w-4 h-4 ${forceMode ? 'text-primary' : 'text-text/40'}`} />
                    </label>
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
                        disabled={processing !== null || (!forceMode && missingCount === 0)}
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
                                {forceMode ? "Refresh All" : "Fill Missing"}
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
                                        {(m.hasMissing || forceMode) && (
                                            <button
                                                onClick={() => handleBackfillMonth(m.yearMonth)}
                                                disabled={processing !== null}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                                                    forceMode && !m.hasMissing
                                                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                                        : 'bg-tertiary/30 hover:bg-tertiary'
                                                }`}
                                                title={forceMode && !m.hasMissing ? "Force refresh this month" : "Generate missing data"}
                                            >
                                                {processing === m.yearMonth ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : forceMode && !m.hasMissing ? (
                                                    <RotateCcw className="w-4 h-4" />
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
