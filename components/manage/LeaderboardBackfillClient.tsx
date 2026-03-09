"use client"

import { useState } from "react"
import { Calendar, Database, RefreshCw, Trash2, AlertTriangle, CheckCircle } from "lucide-react"
import { backfillLeaderboardSnapshots, deleteLeaderboardSnapshots } from "@/app/api/actions/admin"

export default function LeaderboardBackfillClient() {
    const [yearMonth, setYearMonth] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [result, setResult] = useState<{
        type: "success" | "error"
        message: string
        details?: { userCount?: number; cafeCount?: number; deletedCount?: number }
    } | null>(null)

    const handleBackfill = async () => {
        if (!yearMonth) return

        setIsLoading(true)
        setResult(null)

        try {
            const response = await backfillLeaderboardSnapshots(yearMonth)
            setResult({
                type: response.success ? "success" : "error",
                message: response.message,
                details: response.success
                    ? { userCount: response.userCount, cafeCount: response.cafeCount }
                    : undefined,
            })
        } catch (error) {
            setResult({
                type: "error",
                message: error instanceof Error ? error.message : "Unknown error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!yearMonth) return
        if (!confirm(`Are you sure you want to delete all snapshots for ${yearMonth}? This cannot be undone.`)) {
            return
        }

        setIsDeleting(true)
        setResult(null)

        try {
            const response = await deleteLeaderboardSnapshots(yearMonth)
            setResult({
                type: response.success ? "success" : "error",
                message: response.message,
                details: response.success ? { deletedCount: response.deletedCount } : undefined,
            })
        } catch (error) {
            setResult({
                type: "error",
                message: error instanceof Error ? error.message : "Unknown error",
            })
        } finally {
            setIsDeleting(false)
        }
    }

    // Get current month in YYYY-MM format for max attribute
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    return (
        <div className='space-y-6'>
            {/* Input Section */}
            <div className='bg-background rounded-xl p-6 shadow-sm border border-tertiary/50'>
                <h2 className='text-lg font-semibold text-text mb-4'>Select Month</h2>

                <div className='flex flex-col sm:flex-row gap-4'>
                    <div className='flex-1'>
                        <label className='block text-sm font-medium text-text/70 mb-2'>
                            Year-Month (YYYY-MM)
                        </label>
                        <div className='relative'>
                            <Calendar className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text/40' />
                            <input
                                type='month'
                                value={yearMonth}
                                onChange={(e) => setYearMonth(e.target.value)}
                                max={currentMonth}
                                className='w-full pl-10 pr-4 py-2 rounded-lg border border-tertiary/50 bg-background text-text focus:outline-hidden focus:ring-2 focus:ring-primary/50'
                            />
                        </div>
                    </div>
                </div>

                <div className='flex flex-wrap gap-3 mt-6'>
                    <button
                        onClick={handleBackfill}
                        disabled={!yearMonth || isLoading || isDeleting}
                        className='flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className='w-4 h-4 animate-spin' />
                                Backfilling...
                            </>
                        ) : (
                            <>
                                <Database className='w-4 h-4' />
                                Backfill Snapshots
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleDelete}
                        disabled={!yearMonth || isLoading || isDeleting}
                        className='flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                    >
                        {isDeleting ? (
                            <>
                                <RefreshCw className='w-4 h-4 animate-spin' />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className='w-4 h-4' />
                                Delete Snapshots
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Result Section */}
            {result && (
                <div
                    className={`rounded-xl p-6 border ${
                        result.type === "success"
                            ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                            : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    }`}
                >
                    <div className='flex items-start gap-3'>
                        {result.type === "success" ? (
                            <CheckCircle className='w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5' />
                        ) : (
                            <AlertTriangle className='w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5' />
                        )}
                        <div>
                            <h3
                                className={`font-semibold ${
                                    result.type === "success"
                                        ? "text-green-800 dark:text-green-200"
                                        : "text-red-800 dark:text-red-200"
                                }`}
                            >
                                {result.type === "success" ? "Success" : "Error"}
                            </h3>
                            <p
                                className={`mt-1 ${
                                    result.type === "success"
                                        ? "text-green-700 dark:text-green-300"
                                        : "text-red-700 dark:text-red-300"
                                }`}
                            >
                                {result.message}
                            </p>

                            {result.details && result.type === "success" && (
                                <div className='mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4'>
                                    {result.details.userCount !== undefined && (
                                        <div className='bg-white dark:bg-black/20 rounded-lg p-3'>
                                            <div className='text-2xl font-bold text-green-700 dark:text-green-300'>
                                                {result.details.userCount}
                                            </div>
                                            <div className='text-sm text-green-600 dark:text-green-400'>User Snapshots</div>
                                        </div>
                                    )}
                                    {result.details.cafeCount !== undefined && (
                                        <div className='bg-white dark:bg-black/20 rounded-lg p-3'>
                                            <div className='text-2xl font-bold text-green-700 dark:text-green-300'>
                                                {result.details.cafeCount}
                                            </div>
                                            <div className='text-sm text-green-600 dark:text-green-400'>Cafe Snapshots</div>
                                        </div>
                                    )}
                                    {result.details.deletedCount !== undefined && (
                                        <div className='bg-white dark:bg-black/20 rounded-lg p-3'>
                                            <div className='text-2xl font-bold text-green-700 dark:text-green-300'>
                                                {result.details.deletedCount}
                                            </div>
                                            <div className='text-sm text-green-600 dark:text-green-400'>Deleted</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div className='bg-text/5 rounded-xl p-6'>
                <h3 className='font-semibold text-text mb-3'>About Backfill</h3>
                <ul className='space-y-2 text-sm text-text/70'>
                    <li>
                        • Use this tool to manually backfill leaderboard data for months that weren&apos;t automatically snapshotted by the cron job.
                    </li>
                    <li>• The backfill process computes live leaderboard data and stores it in the database as snapshots.
                    </li>
                    <li>• Once snapshotted, future requests for that month will use the cached data instead of computing live.
                    </li>
                    <li>• If you need to re-backfill a month, first delete the existing snapshots, then run backfill again.
                    </li>
                    <li>• Backfilling creates snapshots for all regions (global + all 16 PH regions) for both users and cafes.
                    </li>
                </ul>
            </div>
        </div>
    )
}
