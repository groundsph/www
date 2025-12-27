"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
    X,
    History,
    Plus,
    Pencil,
    CheckCircle,
    ImageIcon,
    Lightbulb,
} from "lucide-react"
import {
    getCafeContributions,
    ContributionLogWithAuthor,
} from "@/app/api/actions/contributions"

interface ContributionHistoryModalProps {
    isOpen: boolean
    onClose: () => void
    cafeId: string
    cafeName: string
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
    MEDIA: "Added photos",
    SUGGEST: "Suggested edit",
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
            return diffMinutes <= 1 ? "Just now" : `${diffMinutes} minutes ago`
        }
        return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`
    }
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
}

export default function ContributionHistoryModal({
    isOpen,
    onClose,
    cafeId,
    cafeName,
}: ContributionHistoryModalProps) {
    const [contributions, setContributions] = useState<
        ContributionLogWithAuthor[]
    >([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (isOpen) {
            setLoading(true)
            getCafeContributions(cafeId).then((data) => {
                setContributions(data)
                setLoading(false)
            })
        }
    }, [isOpen, cafeId])

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div
            className='fixed inset-0 z-50 flex items-center justify-center p-4'
            role='dialog'
            aria-modal='true'
            aria-label='Contribution history'
        >
            {/* Backdrop */}
            <div
                className='absolute inset-0 bg-black/60 backdrop-blur-sm'
                onClick={onClose}
            />

            {/* Modal */}
            <div className='relative bg-background rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col'>
                {/* Header */}
                <div className='flex items-center justify-between p-4 border-b border-text/10'>
                    <div className='flex items-center gap-2'>
                        <History className='w-5 h-5 text-accent' />
                        <h2 className='text-lg font-semibold'>
                            Contribution History
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className='p-2 rounded-lg hover:bg-text/5 transition-colors cursor-pointer'
                        aria-label='Close modal'
                    >
                        <X className='w-5 h-5' />
                    </button>
                </div>

                {/* Subtitle */}
                <div className='px-4 py-2 bg-tertiary/30 border-b border-text/10'>
                    <p className='text-sm text-text/60'>
                        Contributions to{" "}
                        <span className='font-medium text-text'>
                            {cafeName}
                        </span>
                    </p>
                </div>

                {/* Content */}
                <div className='flex-1 overflow-y-auto p-4'>
                    {loading ? (
                        <div className='flex items-center justify-center py-12'>
                            <div className='animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full' />
                        </div>
                    ) : contributions.length === 0 ? (
                        <div className='text-center py-12 text-text/50'>
                            <History className='w-12 h-12 mx-auto mb-3 opacity-30' />
                            <p>No contribution history yet</p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {contributions.map((log) => {
                                const Icon =
                                    ACTION_ICONS[log.action_type] || Pencil
                                const label =
                                    ACTION_LABELS[log.action_type] ||
                                    log.action_type
                                const details = log.details as {
                                    summary?: string
                                } | null

                                return (
                                    <div
                                        key={log.id}
                                        className='flex items-start gap-3 p-3 rounded-xl bg-text/5 hover:bg-text/10 transition-colors'
                                    >
                                        {/* Icon */}
                                        <div className='shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center'>
                                            <Icon className='w-4 h-4 text-accent' />
                                        </div>

                                        {/* Content */}
                                        <div className='flex-1 min-w-0'>
                                            <div className='flex items-center gap-2 flex-wrap'>
                                                <span className='font-medium text-sm'>
                                                    {label}
                                                </span>
                                                <span className='text-text/40'>
                                                    by
                                                </span>
                                                <Link
                                                    href={`/profile/${log.author.username}`}
                                                    className='flex items-center gap-1.5 hover:text-accent transition-colors'
                                                >
                                                    {log.author.avatar_url ? (
                                                        <Image
                                                            src={
                                                                log.author
                                                                    .avatar_url
                                                            }
                                                            alt={
                                                                log.author
                                                                    .display_name
                                                            }
                                                            width={18}
                                                            height={18}
                                                            className='rounded-full'
                                                        />
                                                    ) : (
                                                        <div className='w-[18px] h-[18px] rounded-full bg-tertiary' />
                                                    )}
                                                    <span className='text-sm font-medium'>
                                                        {
                                                            log.author
                                                                .display_name
                                                        }
                                                    </span>
                                                </Link>
                                            </div>
                                            {details?.summary && (
                                                <p className='text-sm text-text/60 mt-0.5 truncate'>
                                                    {details.summary}
                                                </p>
                                            )}
                                            <p className='text-xs text-text/40 mt-1'>
                                                {log.created_at &&
                                                    formatRelativeTime(
                                                        log.created_at
                                                    )}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
