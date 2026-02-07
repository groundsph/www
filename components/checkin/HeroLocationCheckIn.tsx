"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { NearbyCafe } from "@/app/api/actions/nearby"
import GroupCheckInModal from "@/components/checkin/GroupCheckInModal"
import { recordVisit, getTodayCheckIn } from "@/app/api/actions/profile"
import { useAuth } from "@/components/layout/AuthProvider"
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
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (nearbyCafe && user) {
            getTodayCheckIn(nearbyCafe.id).then((result) => {
                setHasCheckedIn(!!result)
            })
        }
    }, [nearbyCafe, user])

    // Don't render anything if no nearby cafe (this means user either
    // hasn't granted GPS permission or isn't near a registered cafe)
    if (!nearbyCafe) return null

    const handleCheckInClick = () => {
        if (!user) {
            router.push("/auth?callbackUrl=/cafes/" + nearbyCafe.slug)
            return
        }
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
                                className="font-bold text-primary hover:underline underline-offset-2 transition-all"
                            >
                                Check In
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
                onCheckIn={(companions) => recordVisit(nearbyCafe.id, companions)}
                onComplete={() => {
                    setIsCheckInModalOpen(false)
                    setHasCheckedIn(true)
                }}
            />
        </>
    )
}
