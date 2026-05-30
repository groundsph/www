"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { XIcon } from "lucide-react"
import Link from "next/link"

export default function AnalyticsBanner() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Check if user has already acknowledged
        const acknowledged = localStorage.getItem("analytics-acknowledged")
        if (!acknowledged) {
            // Small delay so it doesn't pop up immediately on page load
            const timer = setTimeout(() => setIsVisible(true), 1500)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleAcknowledge = () => {
        localStorage.setItem("analytics-acknowledged", "true")
        setIsVisible(false)
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    transition={{ duration: 0.3 }}
                    className='fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50'
                >
                    <div className='bg-background border border-text/20 rounded-xl p-4 shadow-xl'>
                        <div className='flex flex-row items-start gap-3'>
                            <div className='flex-1'>
                                <p className='font-semibold text-sm mb-1'>
                                    🍪 Analytics Notice
                                </p>
                                <p className='text-xs text-text/70'>
                                    We use{" "}
                                    <Link
                                        href='https://ranio.xyz'
                                        target='_blank'
                                        className='underline hover:text-text'
                                    >
                                        Rybbit Analytics
                                    </Link>{" "}
                                    to understand how visitors use our site. No
                                    personal data is collected.
                                </p>
                            </div>
                            <button
                                onClick={handleAcknowledge}
                                className='p-1 hover:bg-text/10 rounded-md transition-colors cursor-pointer'
                                aria-label='Dismiss'
                            >
                                <XIcon className='w-4 h-4' />
                            </button>
                        </div>
                        <button
                            onClick={handleAcknowledge}
                            className='mt-3 w-full py-1.5 bg-text text-background text-sm font-semibold rounded-lg hover:bg-text/80 transition-colors cursor-pointer'
                        >
                            Got it
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
