"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/utils/cn"

interface UserAvatarProps {
    /** The user's avatar URL. If null/undefined or the URL fails to load, falls back to the default. */
    src: string | null | undefined
    /** Alt text for the image (typically the user's display name). */
    alt: string
    /** Width and height in pixels. The container is always a square. */
    size: number
    /** Extra Tailwind classes applied to the outer wrapper div. */
    className?: string
}

/**
 * Renders a user avatar with automatic fallback.
 *
 * - If `src` is null/undefined → shows fallback immediately.
 * - If `src` is a URL that fails to load (404, expired OAuth photo, etc.) → catches
 *   the error and switches to the fallback.
 * - Fallback: Grounds default icon (/icon.png).
 */
export function UserAvatar({ src, alt, size, className }: UserAvatarProps) {
    const [hasError, setHasError] = useState(false)

    const showFallback = !src || hasError

    return (
        <div
            className={cn("relative overflow-hidden rounded-full", className)}
            style={{ width: size, height: size }}
        >
            {showFallback ? (
                <Image
                    src="/icon.png"
                    alt="Default avatar"
                    fill
                    className="object-cover"
                />
            ) : (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    className="object-cover"
                    onError={() => setHasError(true)}
                />
            )}
        </div>
    )
}
