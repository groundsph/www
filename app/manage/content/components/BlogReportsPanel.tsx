"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
    Flag,
    ExternalLink,
    Check,
    X,
    Loader2,
    ChevronDown,
    ChevronUp,
    AlertCircle,
} from "lucide-react"
import {
    getBlogReports,
    resolveBlogReport,
    type PaginatedBlogReportsResult,
} from "@/app/api/actions/blog-report"
import { BlogReport, BLOG_REPORT_REASONS } from "@/utils/types/blog-report"
import { formatDistanceToNow } from "date-fns"

export default function BlogReportsPanel() {
    const [reports, setReports] = useState<BlogReport[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)
    const [expandedReport, setExpandedReport] = useState<string | null>(null)
    const [filter, setFilter] = useState<
        "pending" | "reviewed" | "dismissed" | undefined
    >("pending")

    const loadReports = async () => {
        setLoading(true)
        const result = await getBlogReports({ status: filter })
        setReports(result.reports)
        setLoading(false)
    }

    useEffect(() => {
        loadReports()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter])

    const handleResolve = async (
        reportId: string,
        resolution: "review" | "dismiss"
    ) => {
        setProcessing(reportId)
        const result = await resolveBlogReport(reportId, resolution)
        if (result.success) {
            setReports((prev) => prev.filter((r) => r.id !== reportId))
        } else {
            alert(result.error || "Failed to resolve report")
        }
        setProcessing(null)
    }

    const getReasonLabel = (reason: string) => {
        const found = BLOG_REPORT_REASONS.find((r) => r.value === reason)
        return found?.label || reason
    }

    const toggleExpand = (reportId: string) => {
        setExpandedReport((prev) => (prev === reportId ? null : reportId))
    }

    if (loading) {
        return (
            <div className='flex items-center justify-center py-16'>
                <Loader2 className='w-6 h-6 animate-spin text-text opacity-40' />
            </div>
        )
    }

    return (
        <div className='space-y-4'>
            {/* Filter tabs */}
            <div className='flex gap-2 overflow-x-auto py-1'>
                {(["pending", "reviewed", "dismissed"] as const).map(
                    (status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                filter === status
                                    ? "bg-primary text-white"
                                    : "bg-tertiary/30 text-text/70 hover:bg-tertiary"
                            }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    )
                )}
            </div>

            {/* Reports list */}
            {reports.length === 0 ? (
                <div className='text-center py-16'>
                    <Check className='w-12 h-12 mx-auto text-green-500 mb-4' />
                    <p className='text-text/60 text-lg'>No {filter} reports</p>
                    <p className='text-text/40 text-sm mt-1'>
                        {filter === "pending"
                            ? "All blog reports have been handled!"
                            : `No ${filter} reports found.`}
                    </p>
                </div>
            ) : (
                <div className='space-y-3'>
                    {reports.map((report) => {
                        const isExpanded = expandedReport === report.id
                        const isProcessing = processing === report.id

                        return (
                            <div
                                key={report.id}
                                className='bg-background border border-tertiary/50 rounded-xl overflow-hidden shadow-sm'
                            >
                                {/* Main row */}
                                <div className='p-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4'>
                                    <div className='shrink-0'>
                                        <div className='w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center'>
                                            <Flag className='w-5 h-5 text-red-500' />
                                        </div>
                                    </div>

                                    <div className='flex-1 min-w-0'>
                                        <div className='flex items-center gap-2 flex-wrap'>
                                            <span className='font-semibold truncate'>
                                                {report.blog_post?.title ||
                                                    "Unknown Post"}
                                            </span>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs ${
                                                    report.status === "pending"
                                                        ? "bg-yellow-500/20 text-yellow-600"
                                                        : report.status ===
                                                            "reviewed"
                                                          ? "bg-green-500/20 text-green-600"
                                                          : "bg-gray-500/20 text-gray-600"
                                                }`}
                                            >
                                                {report.status}
                                            </span>
                                        </div>
                                        <p className='text-text/60 text-sm mt-1'>
                                            Reported by{" "}
                                            <span className='font-medium'>
                                                {report.reporter
                                                    ?.display_name || "Unknown"}
                                            </span>{" "}
                                            • {getReasonLabel(report.reason)}
                                        </p>
                                        <p className='text-text/40 text-xs mt-1'>
                                            {report.created_at &&
                                                formatDistanceToNow(
                                                    new Date(report.created_at),
                                                    {
                                                        addSuffix: true,
                                                    }
                                                )}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className='flex items-center gap-2 shrink-0 self-end sm:self-center'>
                                        {report.status === "pending" && (
                                            <>
                                                <button
                                                    onClick={() =>
                                                        handleResolve(
                                                            report.id,
                                                            "review"
                                                        )
                                                    }
                                                    disabled={isProcessing}
                                                    className='p-2 bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50'
                                                    title='Archive post and mark reviewed'
                                                >
                                                    <Check className='w-5 h-5' />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleResolve(
                                                            report.id,
                                                            "dismiss"
                                                        )
                                                    }
                                                    disabled={isProcessing}
                                                    className='p-2 bg-gray-500/20 text-gray-600 rounded-lg hover:bg-gray-500/30 transition disabled:opacity-50'
                                                    title='Dismiss report'
                                                >
                                                    <X className='w-5 h-5' />
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() =>
                                                toggleExpand(report.id)
                                            }
                                            className='p-2 bg-tertiary/30 rounded-lg hover:bg-tertiary transition'
                                            title='View details'
                                        >
                                            {isExpanded ? (
                                                <ChevronUp className='w-5 h-5' />
                                            ) : (
                                                <ChevronDown className='w-5 h-5' />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className='border-t border-tertiary/50 p-4 space-y-4 bg-tertiary/10'>
                                        {report.details && (
                                            <div>
                                                <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                    Reporter's Details
                                                </h4>
                                                <p className='text-sm text-text/80 whitespace-pre-wrap'>
                                                    {report.details}
                                                </p>
                                            </div>
                                        )}

                                        {report.admin_notes && (
                                            <div>
                                                <h4 className='text-xs font-medium text-text/40 uppercase mb-2'>
                                                    Admin Notes
                                                </h4>
                                                <p className='text-sm text-text/80'>
                                                    {report.admin_notes}
                                                </p>
                                            </div>
                                        )}

                                        {report.blog_post && (
                                            <div className='pt-2 flex gap-4 flex-wrap'>
                                                <Link
                                                    href={`/blog/${report.blog_post.slug}`}
                                                    className='text-sm text-primary hover:underline inline-flex items-center gap-1'
                                                    target='_blank'
                                                >
                                                    View blog post{" "}
                                                    <ExternalLink className='w-3 h-3' />
                                                </Link>
                                                {report.reporter && (
                                                    <Link
                                                        href={`/profile/${report.reporter.username}`}
                                                        className='text-sm text-primary hover:underline inline-flex items-center gap-1'
                                                    >
                                                        View reporter profile{" "}
                                                        <ExternalLink className='w-3 h-3' />
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
