"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
    History,
    Plus,
    Pencil,
    CheckCircle,
    ImageIcon,
    Lightbulb,
} from "lucide-react"
import {
    getUserContributions,
    ContributionLogWithCafe,
} from "@/app/api/actions/contributions"

interface ContributionTimelineProps {
    userId: string
}

const ACTION_ICONS = {
    CREATE: Plus,
    UPDATE: Pencil,
    VERIFY: CheckCircle,
    MEDIA: ImageIcon,
    SUGGEST: Lightbulb,
}

const ACTION_LABELS = {
    CREATE: "Scouted",
    UPDATE: "Updated",
    VERIFY: "Verified",
    MEDIA: "Added photos to",
    SUGGEST: "Suggested edit for",
}

const ACTION_COLORS = {
    CREATE: "bg-emerald-500/10 text-emerald-600",
    UPDATE: "bg-blue-500/10 text-blue-600",
    VERIFY: "bg-purple-500/10 text-purple-600",
    MEDIA: "bg-amber-500/10 text-amber-600",
    SUGGEST: "bg-orange-500/10 text-orange-600",
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffMs / (1000 * 60))
            return diffMinutes <= 1 ? "Just now" : `${diffMinutes}m ago`
        }
        return `${diffHours}h ago`
    }
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
}

export default function ContributionTimeline({
    userId,
}: ContributionTimelineProps) {
    const [contributions, setContributions] = useState<
        ContributionLogWithCafe[]
    >([])
    const [loading, setLoading] = useState(true)
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        getUserContributions(userId).then((data) => {
            setContributions(data)
            setLoading(false)
        })
    }, [userId])

    if (loading) {
        return (
            <div className='p-6'>
                <div className='flex items-center gap-2 mb-4'>
                    <History className='w-5 h-5 text-accent' />
                    <h3 className='font-semibold'>Contributions</h3>
                </div>
                <div className='flex items-center justify-center py-8'>
                    <div className='animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full' />
                </div>
            </div>
        )
    }

    const visibleContributions = contributions.filter(
        (log) => log.action_type !== "SUGGEST"
    )

    if (visibleContributions.length === 0) {
        return (
            <div className='p-6'>
                <div className='flex items-center gap-2 mb-4'>
                    <History className='w-5 h-5 text-accent' />
                    <h3 className='font-semibold'>Contributions</h3>
                </div>
                <div className='text-center py-8 text-text/50'>
                    <History className='w-10 h-10 mx-auto mb-2 opacity-30' />
                    <p className='text-sm'>No contributions yet</p>
                </div>
            </div>
        )
    }

    const displayedContributions = showAll
        ? visibleContributions
        : visibleContributions.slice(0, 5)

    return (
        <div className='p-6'>
            <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center gap-2'>
                    <History className='w-5 h-5 text-accent' />
                    <h3 className='font-semibold'>Contributions</h3>
                    <span className='text-sm text-text/50'>
                        ({visibleContributions.length})
                    </span>
                </div>
            </div>

            <div className='space-y-3'>
                {displayedContributions.map((log) => {
                    const Icon = ACTION_ICONS[log.action_type] || Pencil
                    const label =
                        ACTION_LABELS[log.action_type] || log.action_type
                    const colorClass =
                        ACTION_COLORS[log.action_type] || "bg-text/10 text-text"

                    return (
                        <div
                            key={log.id}
                            className='flex items-start gap-3'
                        >
                            {/* Icon */}
                            <div
                                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}
                            >
                                <Icon className='w-4 h-4' />
                            </div>

                            {/* Content */}
                            <div className='flex-1 min-w-0'>
                                <div className='flex items-center gap-1 text-sm'>
                                    <span className='text-text/60'>
                                        {label}
                                    </span>
                                    <Link
                                        href={`/cafes/${log.cafe.slug}`}
                                        className='font-medium hover:text-accent transition-colors flex items-center gap-2'
                                    >
                                        <span className='truncate'>
                                            {log.cafe.name}
                                        </span>
                                    </Link>
                                </div>
                                <p className='text-xs text-text/40 mt-0.5'>
                                    {log.created_at &&
                                        formatRelativeTime(log.created_at)}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {visibleContributions.length > 5 && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className='w-full mt-4 py-2 text-sm text-accent hover:text-accent/80 transition-colors cursor-pointer'
                >
                    {showAll
                        ? "Show less"
                        : `Show all ${visibleContributions.length} contributions`}
                </button>
            )}
        </div>
    )
}
