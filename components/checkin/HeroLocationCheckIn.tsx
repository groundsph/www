"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion } from "motion/react"
import { NearbyCafeDetail } from "@/app/api/actions/nearby"
import GroupCheckInModal, { UserResult as Companion } from "@/components/checkin/GroupCheckInModal"
import { recordVisit, getTodayCheckIn, getVisitCount, updateCheckIn } from "@/app/api/actions/profile"
import { useAuth } from "@/components/layout/AuthProvider"
import { useHaptics } from "@/hooks/useHaptics"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface HeroLocationCheckInProps {
    nearbyCafe: NearbyCafeDetail | null
    /**
     * True once the presence gate is confident enough to offer the prompt
     * unprompted. The parent owns the gate; this component only reacts to it.
     */
    shouldPrompt?: boolean
    /** Called when the auto-open prompt is actually shown. */
    onPromptShown?: () => void
    /** Called when the visitor declines the auto-open prompt. */
    onDismiss?: () => void
    /** Called after an explicit tap so the same cafe is not auto-offered today. */
    onManualPrompt?: () => void
}

export default function HeroLocationCheckIn({
    nearbyCafe,
    shouldPrompt = false,
    onPromptShown,
    onDismiss,
    onManualPrompt,
}: HeroLocationCheckInProps) {
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false)
    const [hasCheckedIn, setHasCheckedIn] = useState(false)
    const [visitedToday, setVisitedToday] = useState(false)
    const [visitCount, setVisitCount] = useState(0)
    const [initialCompanions, setInitialCompanions] = useState<Companion[]>([])
    const [isCheckingStatus, setIsCheckingStatus] = useState(false)
    const { user } = useAuth()
    const { trigger } = useHaptics()
    const router = useRouter()
    const prevCafeIdRef = useRef<string | null>(null)
    /** Tracks whether the currently open modal was opened by the presence gate. */
    const [openedAutomatically, setOpenedAutomatically] = useState(false)

    /**
     * Returns today's visit state as well as storing it, so callers that need to
     * decide *before* rendering (the auto-open path) do not have to wait a
     * render to read fresh React state.
     */
    const refreshVisitStatus = useCallback(async (): Promise<{
        visitedToday: boolean
    }> => {
        if (!nearbyCafe || !user) {
            setHasCheckedIn(false)
            setVisitedToday(false)
            setVisitCount(0)
            setInitialCompanions([])
            return { visitedToday: false }
        }

        setIsCheckingStatus(true)
        try {
            const [todayCheckIn, countResult] = await Promise.all([
                getTodayCheckIn(nearbyCafe.id),
                getVisitCount(nearbyCafe.id),
            ])
            setVisitedToday(!!todayCheckIn)
            setHasCheckedIn(!!todayCheckIn)
            setInitialCompanions(todayCheckIn?.companions ?? [])
            setVisitCount(countResult.count ?? 0)
            return { visitedToday: !!todayCheckIn }
        } catch (error) {
            console.error("Failed to refresh visit status:", error)
            return { visitedToday: false }
        } finally {
            setIsCheckingStatus(false)
        }
    }, [nearbyCafe, user])

    // Store refreshVisitStatus in a ref to avoid circular dependency
    const refreshRef = useRef(refreshVisitStatus)
    refreshRef.current = refreshVisitStatus

    useEffect(() => {
        const cafeId = nearbyCafe?.id ?? null
        if (cafeId && user?.id && cafeId !== prevCafeIdRef.current) {
            prevCafeIdRef.current = cafeId
            refreshRef.current()
        }
    }, [nearbyCafe?.id, user?.id])

    // ------------------------------------------------------------------
    // Auto-open
    //
    // Signed-out visitors are excluded on purpose: the modal would only lead
    // to an auth redirect, which is a worse interruption than no interruption.
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!shouldPrompt || isCheckInModalOpen || hasCheckedIn) return
        if (!nearbyCafe || !user) return

        let cancelled = false

        const open = async () => {
            const status = await refreshRef.current()
            if (cancelled) return

            // Already checked in here today: the inline line already says so, and
            // opening a modal just to announce it would be a wasted interruption.
            if (status.visitedToday) return

            setIsCheckInModalOpen(true)
            setOpenedAutomatically(true)
            onPromptShown?.()
            trigger("light")
        }

        open()

        return () => {
            cancelled = true
        }
        // `refreshRef` is stable by design; the gate values are the real inputs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldPrompt, nearbyCafe?.id, user?.id, hasCheckedIn, isCheckInModalOpen])

    // Don't render anything if no nearby cafe (this means user either
    // hasn't granted GPS permission or isn't near a registered cafe)
    if (!nearbyCafe) return null

    const handleCheckInClick = async () => {
        trigger("medium")
        if (!user) {
            router.push("/auth?callbackUrl=/cafes/" + nearbyCafe.slug)
            return
        }
        onManualPrompt?.()
        await refreshVisitStatus()
        setOpenedAutomatically(false)
        setIsCheckInModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsCheckInModalOpen(false)
        setOpenedAutomatically(false)
    }

    const handleDismissPrompt = () => {
        trigger("soft")
        onDismiss?.()
        handleCloseModal()
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                className='flex items-center gap-3 text-text/80'
                aria-live='polite'
            >
                <span className='text-sm'>
                    {hasCheckedIn ? "You are at " : "Are you at "}
                    <Link
                        href={`/cafes/${nearbyCafe.slug}`}
                        className='font-bold text-primary hover:underline underline-offset-2 transition-all'
                    >
                        {nearbyCafe.name}
                    </Link>
                    {hasCheckedIn ? (
                        <>
                            .{" "}
                            <span className='font-bold text-primary'>
                                Checked in today ✓
                            </span>
                        </>
                    ) : (
                        <>
                            ?{" "}
                            <button
                                onClick={handleCheckInClick}
                                disabled={isCheckingStatus}
                                className='font-bold text-primary hover:underline underline-offset-2 transition-all disabled:opacity-60'
                            >
                                {isCheckingStatus ? "Checking..." : "Check In"}
                            </button>
                        </>
                    )}
                </span>
            </motion.div>

            {/* Check-in Modal */}
            <GroupCheckInModal
                isOpen={isCheckInModalOpen}
                onClose={handleCloseModal}
                cafeName={nearbyCafe.name}
                cafe={nearbyCafe}
                confirmLabel={
                    visitedToday ? "Update Check-in" : "Yes, I'm here"
                }
                onDismiss={openedAutomatically ? handleDismissPrompt : undefined}
                onCheckIn={async (companions) => {
                    const result = await recordVisit(nearbyCafe.id, companions)
                    if (result?.alreadyVisitedToday) {
                        setHasCheckedIn(true)
                        setVisitedToday(true)
                    }
                    if (result?.success) {
                        trigger("success")
                    } else if (result?.error) {
                        trigger("error")
                    }
                    return result
                }}
                onUpdateCheckIn={(companions) => updateCheckIn(nearbyCafe.id, companions)}
                visitedToday={visitedToday}
                visitCount={visitCount}
                initialCompanions={initialCompanions}
                onComplete={() => {
                    setIsCheckInModalOpen(false)
                    setOpenedAutomatically(false)
                    setHasCheckedIn(true)
                    setVisitedToday(true)
                }}
            />
        </>
    )
}
