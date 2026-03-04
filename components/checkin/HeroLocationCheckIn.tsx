"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion } from "motion/react"
import { NearbyCafe } from "@/app/api/actions/nearby"
import GroupCheckInModal, { UserResult as Companion } from "@/components/checkin/GroupCheckInModal"
import { recordVisit, getTodayCheckIn, getVisitCount, updateCheckIn } from "@/app/api/actions/profile"
import { useAuth } from "@/components/layout/AuthProvider"
import { useHaptics } from "@/hooks/useHaptics"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface HeroLocationCheckInProps {
    nearbyCafe: NearbyCafe | null
}

export default function HeroLocationCheckIn({
    nearbyCafe,
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

    const refreshVisitStatus = useCallback(async () => {
        if (!nearbyCafe || !user) {
            setHasCheckedIn(false)
            setVisitedToday(false)
            setVisitCount(0)
            setInitialCompanions([])
            return
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
        } catch (error) {
            console.error("Failed to refresh visit status:", error)
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

    // Don't render anything if no nearby cafe (this means user either
    // hasn't granted GPS permission or isn't near a registered cafe)
    if (!nearbyCafe) return null

    const handleCheckInClick = async () => {
        trigger("medium")
        if (!user) {
            router.push("/auth?callbackUrl=/cafes/" + nearbyCafe.slug)
            return
        }
        await refreshVisitStatus()
        setIsCheckInModalOpen(true)
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                className="flex items-center gap-3 text-text/80"
            >
                <span className="text-sm">
                    {hasCheckedIn ? "You are at " : "Are you at "}
                    <Link
                        href={`/cafes/${nearbyCafe.slug}`}
                        className="font-bold text-primary hover:underline underline-offset-2 transition-all"
                    >
                        {nearbyCafe.name}
                    </Link>
                    {hasCheckedIn ? (
                        <>
                            .{" "}
                            <span className="font-bold text-primary">
                                Checked in today ✓
                            </span>
                        </>
                    ) : (
                        <>
                            ?{" "}
                            <button
                                onClick={handleCheckInClick}
                                disabled={isCheckingStatus}
                                className="font-bold text-primary hover:underline underline-offset-2 transition-all disabled:opacity-60"
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
                onClose={() => setIsCheckInModalOpen(false)}
                cafeName={nearbyCafe.name}
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
                    setHasCheckedIn(true)
                    setVisitedToday(true)
                }}
            />
        </>
    )
}
