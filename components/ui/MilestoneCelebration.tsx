"use client"

import { motion, AnimatePresence } from "motion/react"
import { Trophy, Star, Sparkles, X } from "lucide-react"
import { useEffect, useState } from "react"
import confetti from "canvas-confetti"

interface MilestoneCelebrationProps {
    milestone: number | null
    cafeName: string
    onClose: () => void
}

const milestoneConfig: Record<
    number,
    { icon: typeof Trophy; label: string; color: string }
> = {
    5: { icon: Star, label: "Regular!", color: "text-blue-500" },
    10: { icon: Trophy, label: "Loyal Customer!", color: "text-amber-500" },
    25: { icon: Sparkles, label: "Super Fan!", color: "text-purple-500" },
    50: { icon: Trophy, label: "VIP!", color: "text-pink-500" },
    100: { icon: Sparkles, label: "Legend!", color: "text-amber-400" },
}

export default function MilestoneCelebration({
    milestone,
    cafeName,
    onClose,
}: MilestoneCelebrationProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (milestone) {
            // Delay visibility to avoid synchronous render warning and allow animation
            const showTimer = setTimeout(() => setIsVisible(true), 100)

            // Trigger confetti
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#8B4513", "#D2691E", "#F4A460", "#FFD700"],
            })

            // Auto-close after 4 seconds
            const hideTimer = setTimeout(() => {
                setIsVisible(false)
                setTimeout(onClose, 300) // Wait for exit animation
            }, 4000)

            return () => {
                clearTimeout(showTimer)
                clearTimeout(hideTimer)
            }
        }
    }, [milestone, onClose])

    if (!milestone) return null

    const config = milestoneConfig[milestone] || milestoneConfig[5]
    const Icon = config.icon

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'
                    onClick={() => {
                        setIsVisible(false)
                        setTimeout(onClose, 300)
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{
                            type: "spring",
                            damping: 15,
                            stiffness: 300,
                        }}
                        className='relative bg-background rounded-2xl p-8 shadow-2xl max-w-sm mx-4 text-center'
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => {
                                setIsVisible(false)
                                setTimeout(onClose, 300)
                            }}
                            className='absolute top-3 right-3 p-1.5 rounded-full hover:bg-text/10 transition-colors'
                        >
                            <X className='w-4 h-4 text-text opacity-50' />
                        </button>

                        {/* Icon */}
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                                delay: 0.1,
                                type: "spring",
                                stiffness: 200,
                            }}
                            className={`inline-flex p-4 rounded-full bg-primary/10 mb-4`}
                        >
                            <Icon className={`w-12 h-12 ${config.color}`} />
                        </motion.div>

                        {/* Title */}
                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className={`text-2xl font-bold font-serif ${config.color}`}
                        >
                            {config.label}
                        </motion.h2>

                        {/* Message */}
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className='text-text/80 mt-2'
                        >
                            You&apos;ve checked in to{" "}
                            <span className='font-semibold text-text'>
                                {cafeName}
                            </span>{" "}
                            <span className='text-primary font-bold'>
                                {milestone} times!
                            </span>
                        </motion.p>

                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className='text-text/50 text-sm mt-3'
                        >
                            Keep exploring ☕
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
