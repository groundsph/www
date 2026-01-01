"use client"

import { useState, useEffect } from "react"
import { X, PartyPopper, Megaphone, type LucideIcon } from "lucide-react"

// ============================================================
// ANNOUNCEMENT CONFIGURATION
// Edit this object to change the current announcement.
// Set to null when there's no active announcement.
// ============================================================
interface Announcement {
    id: string // Unique ID for localStorage tracking
    message: React.ReactNode
    expiresAt: Date // Banner auto-hides after this date
    icon?: LucideIcon
    link?: { href: string; label: string }
}

const CURRENT_ANNOUNCEMENT: Announcement | null = {
    id: "new-year-2026",
    message: (
        <>
            <span className='font-bold'>Happy New Year 2026! 🎉</span> Wishing
            you a year full of great coffee and cozy cafe moments.
        </>
    ),
    expiresAt: new Date("2026-01-07T23:59:59"), // Show for the first week of January
    icon: PartyPopper,
    link: { href: "/roadmap", label: "See what's brewing" },
}

// ============================================================
// COMPONENT
// ============================================================
export default function AnnouncementBanner() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // No announcement configured
        if (!CURRENT_ANNOUNCEMENT) return

        // Check if announcement has expired
        if (new Date() > CURRENT_ANNOUNCEMENT.expiresAt) return

        // Check if user has dismissed this specific announcement
        const dismissedId = localStorage.getItem("announcement-dismissed-id")
        if (dismissedId === CURRENT_ANNOUNCEMENT.id) return

        const timeoutId = setTimeout(() => setIsVisible(true), 0)
        return () => clearTimeout(timeoutId)
    }, [])

    const handleDismiss = () => {
        if (!CURRENT_ANNOUNCEMENT) return
        setIsVisible(false)
        localStorage.setItem(
            "announcement-dismissed-id",
            CURRENT_ANNOUNCEMENT.id
        )
    }

    if (!isVisible || !CURRENT_ANNOUNCEMENT) return null

    const Icon = CURRENT_ANNOUNCEMENT.icon || Megaphone

    return (
        <div className='w-full bg-linear-to-r from-primary via-secondary to-primary text-background py-2 px-4 relative'>
            <div className='max-w-4xl mx-auto flex items-center justify-center gap-2 text-sm md:text-base font-medium'>
                <Icon className='h-4 w-4 shrink-0' />
                <p className='text-center'>
                    {CURRENT_ANNOUNCEMENT.message}
                    {CURRENT_ANNOUNCEMENT.link && (
                        <>
                            {" "}
                            <a
                                href={CURRENT_ANNOUNCEMENT.link.href}
                                className='underline hover:text-background/80 transition-colors font-semibold'
                            >
                                {CURRENT_ANNOUNCEMENT.link.label}
                            </a>
                        </>
                    )}
                </p>
                <button
                    onClick={handleDismiss}
                    className='absolute right-2 md:right-4 p-1 hover:bg-background/20 rounded transition-colors'
                    aria-label='Dismiss announcement'
                >
                    <X className='h-4 w-4' />
                </button>
            </div>
        </div>
    )
}

// Re-export with old name for backwards compatibility
export { AnnouncementBanner as BetaBanner }
