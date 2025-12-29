"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { getCafeThumbnailUrl } from "@/utils/extras"

interface MenuHeaderProps {
    slug: string
    cafeName: string
    thumbnail: string | null
    addressDisplay: string | null
}

export default function MenuHeader({
    slug,
    cafeName,
    thumbnail,
    addressDisplay,
}: MenuHeaderProps) {
    const [showHeader, setShowHeader] = useState(false)

    useEffect(() => {
        // Check if the user navigated from within the site
        // If referrer contains our domain or history length > 1, they navigated here
        const referrer = document.referrer
        const isInternalNavigation =
            referrer.includes(window.location.host) ||
            // Check if there's browsing history (user navigated here)
            (window.history.length > 1 &&
                // Additional check: sessionStorage flag set by Next.js navigation
                sessionStorage.getItem("__next_scroll") !== null)

        setShowHeader(isInternalNavigation)
    }, [])

    if (!showHeader) {
        return null
    }

    return (
        <header className='sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-text/10'>
            <div className='w-full max-w-4xl mx-auto px-4 py-3 flex items-center gap-3'>
                <Link
                    href={`/cafes/${slug}`}
                    className='p-2 hover:bg-text/10 rounded-full transition-colors'
                >
                    <ArrowLeft className='w-5 h-5' />
                </Link>
                {thumbnail && (
                    <div className='relative w-10 h-10 rounded-full overflow-hidden shrink-0'>
                        <Image
                            src={getCafeThumbnailUrl(thumbnail)}
                            alt={cafeName}
                            fill
                            className='object-cover'
                        />
                    </div>
                )}
                <div className='flex-1 min-w-0'>
                    <h1 className='font-semibold truncate'>{cafeName}</h1>
                    {addressDisplay && (
                        <p className='text-xs text-text/60 truncate'>
                            {addressDisplay}
                        </p>
                    )}
                </div>
            </div>
        </header>
    )
}
