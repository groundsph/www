"use client"

import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { Download, X } from "lucide-react"
import { usePWAInstall } from "@/utils/hooks/usePWAInstall"

export function PWAInstallInline() {
    const { canInstall, dismiss } = usePWAInstall()

    return (
        <AnimatePresence>
            {canInstall && (
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className='w-full bg-primary text-white px-4 py-2 flex items-center justify-center gap-3 text-sm'
                >
                    <div className='flex items-center gap-2 max-w-7xl w-full justify-center'>
                        <Download className='h-4 w-4 shrink-0' />
                        <span className='hidden sm:inline'>
                            Install Grounds for quick access to the Philippines&apos; best cafes
                        </span>
                        <span className='sm:hidden'>
                            Install Grounds app
                        </span>
                        <Link
                            href='/install'
                            className='font-medium underline underline-offset-2 shrink-0 ml-2'
                            onClick={dismiss}
                        >
                            Learn how
                        </Link>
                    </div>
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
