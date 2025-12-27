"use client"

import { Share2 } from "lucide-react"

interface ShareButtonProps {
    title: string
}

export default function ShareButton({ title }: ShareButtonProps) {
    const handleShare = () => {
        if (typeof navigator !== "undefined" && navigator.share) {
            navigator.share({
                title,
                url: window.location.href,
            })
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard?.writeText(window.location.href)
        }
    }

    return (
        <button
            onClick={handleShare}
            className='p-2 rounded-full bg-text/5 hover:bg-text/10 transition-colors'
            aria-label='Share this article'
        >
            <Share2 className='w-5 h-5 text-text/70' />
        </button>
    )
}
