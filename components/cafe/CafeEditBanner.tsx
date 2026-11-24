"use client"

import Link from "next/link"
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Pencil, X } from "lucide-react"

interface CafeEditBannerProps {
    cafeId: string
    cafeSlug: string
    cafeName: string
    role: "admin" | "moderator" | "owner"
}

const ROLE_LABELS: Record<CafeEditBannerProps["role"], string> = {
    admin: "Admin",
    moderator: "Moderator",
    owner: "Owner",
}

/**
 * Where each role maintains a Cafe. Staff work from the moderation preview;
 * an owner maintains their own listing from the owner area of the site.
 */
function editHref(role: CafeEditBannerProps["role"], cafeId: string, cafeSlug: string): string {
    return role === "owner"
        ? `/owner/cafes/${cafeSlug}/edit`
        : `/manage/preview/${cafeId}`
}

export default function CafeEditBanner({ cafeId, cafeSlug, cafeName, role }: CafeEditBannerProps) {
    const [isVisible, setIsVisible] = useState(true)

    const roleLabel = ROLE_LABELS[role]

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className='w-full'
                >
                    <div className='w-full flex items-center justify-between gap-3 bg-primary/10 border border-primary/20 px-4 py-3'>
                        <div className='flex items-center gap-3 min-w-0'>
                            <div className='flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 shrink-0'>
                                <Pencil className='w-4 h-4 text-primary' />
                            </div>
                            <div className='min-w-0'>
                                <p className='text-sm font-semibold text-text'>
                                    {roleLabel} Access
                                </p>
                                <p className='text-xs text-text/60 truncate'>
                                    You can edit {cafeName}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-center gap-2 shrink-0'>
                            <Link
                                href={editHref(role, cafeId, cafeSlug)}
                                className='text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg'
                            >
                                Edit Cafe
                            </Link>
                            <button
                                onClick={() => setIsVisible(false)}
                                className='p-1 rounded-lg hover:bg-text/5 transition-colors'
                                aria-label='Dismiss'
                            >
                                <X className='w-4 h-4 text-text opacity-40' />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
