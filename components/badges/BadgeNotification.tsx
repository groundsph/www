"use client"

import { useEffect, useState, startTransition } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Sparkles } from "lucide-react"
import Image from "next/image"
import * as LucideIcons from "lucide-react"
import type { BadgeDetails } from "@/app/api/actions/badges"

interface BadgeNotificationProps {
    badge: BadgeDetails | null
    isVisible: boolean
    onDismiss: () => void
}

const rarityStyles = {
    common: {
        border: "border-text/30",
        glow: "",
        bg: "bg-text/5",
        label: "text-text/60",
    },
    rare: {
        border: "border-blue-500",
        glow: "shadow-[0_0_20px_rgba(59,130,246,0.4)]",
        bg: "bg-blue-500/10",
        label: "text-blue-500",
    },
    legendary: {
        border: "border-amber-400",
        glow: "shadow-[0_0_24px_rgba(251,191,36,0.5)]",
        bg: "bg-amber-400/10",
        label: "text-amber-500",
    },
}

const rarityLabels = {
    common: "Common",
    rare: "Rare",
    legendary: "Legendary",
}

export default function BadgeNotification({
    badge,
    isVisible,
    onDismiss,
}: BadgeNotificationProps) {
    const [showConfetti, setShowConfetti] = useState(false)
    const [confettiParticles, setConfettiParticles] = useState<Array<{
        id: number
        x: number
        y: number
        rotation: number
        scale: number
        delay: number
        color: string
    }>>([])

    useEffect(() => {
        if (isVisible && badge && badge.rarity !== "common") {
            const length = badge.rarity === "legendary" ? 24 : 12
            const newParticles = Array.from({ length }, (_, i) => ({
                id: i,
                x: Math.random() * 200 - 100,
                y: Math.random() * -150 - 50,
                rotation: Math.random() * 360,
                scale: 0.5 + Math.random() * 0.5,
                delay: Math.random() * 0.3,
                color: badge.rarity === "legendary"
                    ? ["#fbbf24", "#f59e0b", "#d97706"][i % 3]
                    : ["#3b82f6", "#60a5fa", "#93c5fd"][i % 3],
            }))
            startTransition(() => {
                setConfettiParticles(newParticles)
                setShowConfetti(true)
            })
            const hideTimer = setTimeout(() => setShowConfetti(false), 2000)
            return () => clearTimeout(hideTimer)
        }
    }, [isVisible, badge])

    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(onDismiss, 6000)
            return () => clearTimeout(timer)
        }
    }, [isVisible, onDismiss])

    const metadata = badge?.metadata
    const iconName = metadata?.icon_name
    const iconColor = metadata?.icon_color || "#74512d"

    if (!badge) return null

    const styles = rarityStyles[badge.rarity]

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="fixed bottom-6 right-6 z-60 w-[90vw] max-w-sm"
                >
                    {showConfetti && (
                        <div className="absolute inset-0 pointer-events-none overflow-visible">
                            {confettiParticles.map((particle) => (
                                <motion.div
                                    key={particle.id}
                                    initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                                    animate={{
                                        x: particle.x,
                                        y: particle.y,
                                        opacity: 0,
                                        scale: particle.scale,
                                        rotate: particle.rotation,
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        delay: particle.delay,
                                        ease: "easeOut",
                                    }}
                                    className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full"
                                    style={{ backgroundColor: particle.color }}
                                />
                            ))}
                        </div>
                    )}

                    <div
                        className={`
                            relative bg-background rounded-2xl border-2 ${styles.border} ${styles.glow}
                            overflow-hidden cursor-pointer
                        `}
                        onClick={onDismiss}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-text/10">
                            <div className="flex items-center gap-2 text-primary">
                                <Sparkles className="w-4 h-4" />
                                <span className="text-sm font-semibold">Badge Earned!</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDismiss()
                                }}
                                className="p-1 hover:bg-text/10 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4 text-text opacity-60" />
                            </button>
                        </div>

                        <div className="p-4 flex items-center gap-4">
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20,
                                    delay: 0.2,
                                }}
                                className={`
                                    w-16 h-16 shrink-0 rounded-full border-2 ${styles.border}
                                    bg-background flex items-center justify-center ${styles.glow}
                                `}
                            >
                                {iconName ? (
                                    (() => {
                                        const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ style?: { color: string }; className?: string }>>)[iconName]
                                        return Icon ? <Icon style={{ color: iconColor }} className="w-8 h-8" /> : null
                                    })()
                                ) : (
                                    <Image
                                        src={badge.image_url}
                                        alt={badge.name}
                                        width={48}
                                        height={48}
                                        className="object-contain"
                                        unoptimized
                                    />
                                )}
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="flex-1 min-w-0"
                            >
                                <h3 className="text-lg font-bold text-text">
                                    {badge.name}
                                </h3>
                                <p className="text-sm text-text/70 line-clamp-2">
                                    {badge.description}
                                </p>
                                <span
                                    className={`text-xs font-medium ${styles.label} mt-1 inline-block`}
                                >
                                    {rarityLabels[badge.rarity]}
                                </span>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
