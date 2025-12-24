"use client"

import { useState, useEffect } from "react"
import { X, Sparkles } from "lucide-react"

export default function BetaBanner() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Check if user has dismissed the banner
        const dismissed = localStorage.getItem("beta-banner-dismissed")
        if (!dismissed) {
            setIsVisible(true)
        }
    }, [])

    const handleDismiss = () => {
        setIsVisible(false)
        localStorage.setItem("beta-banner-dismissed", "true")
    }

    if (!isVisible) return null

    return (
        <div className='w-full bg-linear-to-r from-primary via-secondary to-primary text-background py-2 px-4 relative'>
            <div className='max-w-4xl mx-auto flex items-center justify-center gap-2 text-sm md:text-base font-medium'>
                <Sparkles className='h-4 w-4 shrink-0' />
                <p className='text-center'>
                    <span className='font-bold'>Welcome to Grounds Beta!</span>{" "}
                    We&apos;re still brewing things up. Found a bug?{" "}
                    <a
                        href='/contact'
                        className='underline hover:text-background/80 transition-colors font-semibold'
                    >
                        Let us know!
                    </a>
                </p>
                <button
                    onClick={handleDismiss}
                    className='absolute right-2 md:right-4 p-1 hover:bg-background/20 rounded transition-colors'
                    aria-label='Dismiss banner'
                >
                    <X className='h-4 w-4' />
                </button>
            </div>
        </div>
    )
}
