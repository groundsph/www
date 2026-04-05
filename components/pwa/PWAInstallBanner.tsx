"use client"

import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { Download, X } from "lucide-react"
import { usePWAInstall } from "@/utils/hooks/usePWAInstall"

export function PWAInstallBanner() {
    const { canInstall, dismiss } = usePWAInstall()

    return (
        <AnimatePresence>
            {canInstall && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className='fixed bottom-0 left-0 right-0 z-50 bg-primary text-white px-4 py-3 flex items-center gap-3'
                    style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
                >
                    <Download className='h-5 w-5 shrink-0' />
                    <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium'>Install Grounds</p>
                        <p className='text-xs opacity-80'>Add to your home screen for the best experience</p>
                    </div>
                    <Link
                        href='/install'
                        className='text-sm font-medium underline underline-offset-2 shrink-0'
                        onClick={dismiss}
                    >
                        How?
                    </Link>
                    <button
                        onClick={dismiss}
                        className='p-1 hover:bg-white/20 rounded-full shrink-0'
                        aria-label='Dismiss install prompt'
                    >
                        <X className='h-4 w-4' />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
