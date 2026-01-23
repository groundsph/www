"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { NearbyCafe } from "@/app/api/actions/nearby"
import GroupCheckInModal from "@/components/checkin/GroupCheckInModal"
import { recordVisit } from "@/app/api/actions/profile"
import { useAuth } from "@/components/AuthProvider"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface HeroLocationCheckInProps {
    nearbyCafe: NearbyCafe | null
}

export default function HeroLocationCheckIn({
    nearbyCafe,
}: HeroLocationCheckInProps) {
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false)
    const { user } = useAuth()
    const router = useRouter()

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
                    Are you at{" "}
                    <Link
                        href={`/cafes/${nearbyCafe.slug}`}
                        className="font-bold text-primary hover:underline underline-offset-2 transition-all"
                    >
                        {nearbyCafe.name}
                    </Link>
                    ?{" "}
                    <button
                        onClick={handleCheckInClick}
                        className="font-bold text-primary hover:underline underline-offset-2 transition-all"
                    >
                        Check In
                    </button>
                </span>
            </motion.div>

            {/* Check-in Modal */}
            <GroupCheckInModal
                isOpen={isCheckInModalOpen}
                onClose={() => setIsCheckInModalOpen(false)}
                cafeName={nearbyCafe.name}
                onCheckIn={(companions) => recordVisit(nearbyCafe.id, companions)}
                onComplete={() => setIsCheckInModalOpen(false)}
            />
        </>
    )
}
