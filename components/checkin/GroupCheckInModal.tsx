"use client"

import { useState, useCallback } from "react"
import {
    X,
    MapPin,
    Users,
    ChevronDown,
    ChevronUp,
    Loader2,
    Coffee,
    Sparkles,
    Trophy,
} from "lucide-react"
import CompanionSelector from "./CompanionSelector"
import type { CheckInResult } from "@/app/api/actions/profile"

interface UserResult {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
}

interface GroupCheckInModalProps {
    isOpen: boolean
    onClose: () => void
    cafeName: string
    onCheckIn: (companionIds?: string[]) => Promise<CheckInResult | undefined>
    /** Called when check-in completes successfully and user dismisses the modal */
    onComplete?: (result: CheckInResult) => void
    visitedToday?: boolean
    visitCount?: number
}

export default function GroupCheckInModal({
    isOpen,
    onClose,
    cafeName,
    onCheckIn,
    onComplete,
    visitedToday = false,
    visitCount = 0,
}: GroupCheckInModalProps) {
    const [selectedCompanions, setSelectedCompanions] = useState<UserResult[]>(
        []
    )
    const [showCompanions, setShowCompanions] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<CheckInResult | null>(null)

    const handleSelect = useCallback((user: UserResult) => {
        setSelectedCompanions((prev) => [...prev, user])
    }, [])

    const handleRemove = useCallback((userId: string) => {
        setSelectedCompanions((prev) => prev.filter((c) => c.id !== userId))
    }, [])

    const handleCheckIn = async () => {
        setIsSubmitting(true)
        try {
            const companionIds = selectedCompanions.map((c) => c.id)
            const checkInResult = await onCheckIn(
                companionIds.length > 0 ? companionIds : undefined
            )
            if (checkInResult) {
                setResult(checkInResult)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setSelectedCompanions([])
        setShowCompanions(false)
        setResult(null)
        onClose()
    }

    const handleDone = () => {
        if (result?.success && onComplete) {
            onComplete(result)
        }
        handleClose()
    }

    if (!isOpen) return null

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            {/* Backdrop */}
            <div
                className='absolute inset-0 bg-black/50 backdrop-blur-sm'
                onClick={handleClose}
            />

            {/* Modal */}
            <div className='relative bg-background rounded-2xl shadow-xl w-full max-w-md'>
                {/* Header */}
                <div className='flex items-center justify-between px-5 py-4 border-b border-text/10 rounded-t-2xl'>
                    <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center'>
                            <MapPin className='w-5 h-5 text-primary' />
                        </div>
                        <div>
                            <h2 className='font-bold text-lg'>Check In</h2>
                            <p className='text-sm text-text/60 truncate max-w-[200px]'>
                                {cafeName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className='p-2 hover:bg-text/5 rounded-full transition-colors'
                    >
                        <X className='w-5 h-5' />
                    </button>
                </div>

                {/* Content */}
                <div className='p-5 space-y-4'>
                    {/* Already visited message */}
                    {visitedToday && !result && (
                        <div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3'>
                            <p className='text-sm text-amber-700 dark:text-amber-300'>
                                You&apos;ve already checked in here today! Check
                                back tomorrow.
                            </p>
                        </div>
                    )}

                    {/* Success result */}
                    {result?.success && (
                        <div className='text-center py-2'>
                            {/* Success icon */}
                            <div className='w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center'>
                                <Coffee className='w-8 h-8 text-primary' />
                            </div>

                            {/* Main message */}
                            <h3 className='text-xl font-bold text-text mb-1'>
                                You&apos;re here!
                            </h3>
                            <p className='text-text/60'>
                                Visit #{result.visitCount} to {cafeName}
                            </p>

                            {/* Additional info badges */}
                            <div className='flex flex-wrap justify-center gap-2 mt-4'>
                                {result.isFirstVisit && (
                                    <span className='inline-flex items-center gap-1 px-3 py-1.5 bg-primary/20 text-primary text-sm font-medium rounded-full'>
                                        <Sparkles className='w-3.5 h-3.5' />{" "}
                                        First visit
                                    </span>
                                )}
                                {result.companions &&
                                    result.companions.length > 0 && (
                                        <span className='inline-flex items-center gap-1 px-3 py-1.5 bg-secondary/40 text-text text-sm font-medium rounded-full'>
                                            <Users className='w-3.5 h-3.5' />{" "}
                                            {result.companions.length} companion
                                            {result.companions.length > 1
                                                ? "s"
                                                : ""}
                                        </span>
                                    )}
                                {result.milestone && (
                                    <span className='inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full'>
                                        <Trophy className='w-3.5 h-3.5' />{" "}
                                        {result.milestone} visits!
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Check-in form */}
                    {!visitedToday && !result && (
                        <>
                            {/* Visit count preview */}
                            {visitCount > 0 && (
                                <p className='text-sm text-text/60 text-center'>
                                    This will be your visit #{visitCount + 1}
                                </p>
                            )}

                            {/* Companions section (collapsible) */}
                            <div className='border border-text/10 rounded-lg'>
                                <button
                                    type='button'
                                    onClick={() =>
                                        setShowCompanions(!showCompanions)
                                    }
                                    className='w-full flex items-center justify-between px-4 py-3 hover:bg-text/5 transition-colors'
                                >
                                    <div className='flex items-center gap-2'>
                                        <Users className='w-4 h-4 text-text/60' />
                                        <span className='text-sm font-medium'>
                                            Add Companions
                                            {selectedCompanions.length > 0 && (
                                                <span className='ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full'>
                                                    {selectedCompanions.length}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {showCompanions ? (
                                        <ChevronUp className='w-4 h-4 text-text/40' />
                                    ) : (
                                        <ChevronDown className='w-4 h-4 text-text/40' />
                                    )}
                                </button>

                                {showCompanions && (
                                    <div className='px-4 pb-4 border-t border-text/10 pt-3'>
                                        <CompanionSelector
                                            selectedCompanions={
                                                selectedCompanions
                                            }
                                            onSelect={handleSelect}
                                            onRemove={handleRemove}
                                            maxCompanions={5}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className='px-5 py-4 border-t border-text/10 bg-text/5 rounded-b-2xl'>
                    {!result ? (
                        <button
                            onClick={handleCheckIn}
                            disabled={visitedToday || isSubmitting}
                            className='w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                    Checking in...
                                </>
                            ) : (
                                <>
                                    <MapPin className='w-4 h-4' />
                                    Check In
                                    {selectedCompanions.length > 0 && (
                                        <span className='text-white/80'>
                                            with {selectedCompanions.length}{" "}
                                            companion
                                            {selectedCompanions.length > 1
                                                ? "s"
                                                : ""}
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleDone}
                            className='w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors'
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
