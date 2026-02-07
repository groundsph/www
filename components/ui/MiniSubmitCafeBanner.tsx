"use client"

import { useState, useEffect } from "react"
import { MapPinIcon, X } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"

interface MiniSubmitCafeBannerProps {
    className?: string
}

export default function MiniSubmitCafeBanner({
    className = "",
}: MiniSubmitCafeBannerProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const dismissed = localStorage.getItem("submit-cafe-banner-dismissed")
        if (!dismissed) {
            const timeoutId = setTimeout(() => setIsVisible(true), 0)
            return () => clearTimeout(timeoutId)
        }
    }, [])

    const handleDismiss = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsVisible(false)
        localStorage.setItem("submit-cafe-banner-dismissed", "true")
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className={`relative ${className}`}
                >
                    <Link
                        href='/submit'
                        className='group block w-full bg-tertiary/30 border border-secondary/30 rounded-xl p-4 hover:bg-tertiary/40 hover:border-secondary/50 transition-all duration-300'
                    >
                        <div className='flex items-center justify-between gap-4'>
                            <div className='flex items-center gap-3'>
                                <div className='shrink-0 w-10 h-10 bg-primary/15 rounded-full flex items-center justify-center group-hover:bg-primary/25 transition-colors'>
                                    <MapPinIcon className='w-5 h-5 text-primary' />
                                </div>
                                <div>
                                    <p className='text-sm md:text-base font-semibold text-text'>
                                        Know a great cafe? Share it with our
                                        community!
                                    </p>
                                    <p className='text-xs text-text/60 hidden md:block'>
                                        Add your favorite spots to the directory
                                    </p>
                                    <p className='text-xs text-text/60 md:hidden block'>
                                        Tap here to add your favorite spots to the directory
                                    </p>
                                </div>
                            </div>
                            <div className='flex items-center gap-2'>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className='hidden md:block px-4 py-2 bg-primary text-background text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors'
                                >
                                    Add Cafe
                                </motion.button>
                                <button
                                    onClick={handleDismiss}
                                    className='p-1.5 hover:bg-text/10 rounded-lg transition-colors cursor-pointer'
                                    aria-label='Dismiss banner'
                                >
                                    <X className='w-4 h-4 text-text/50' />
                                </button>
                            </div>
                        </div>
                    </Link>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
