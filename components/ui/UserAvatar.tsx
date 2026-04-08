"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/utils/cn"
import { getInitials, getAvatarColor } from "@/utils/avatar"

interface UserAvatarProps {
    /** The user's avatar URL. If null/undefined or the URL fails to load, falls back to themed initials. */
    src: string | null | undefined
    /** Alt text for the image (typically the user's display name). Also used for initials/color if fallbackName not set. */
    alt: string
    /** Width and height in pixels. The container is always a square. */
    size: number
    /** Extra Tailwind classes applied to the outer wrapper div. */
    className?: string
    /** Override the name used for initials and color generation. Defaults to `alt`. */
    fallbackName?: string
}

/**
 * Renders a user avatar with automatic themed fallback.
 *
 * - If `src` is a valid URL → shows the image.
 * - If `src` is null/undefined or fails to load → shows initials-based placeholder
 *   with a deterministic background color derived from the user's name.
 */
export function UserAvatar({ src, alt, size, className, fallbackName }: UserAvatarProps) {
    const [hasError, setHasError] = useState(false)

    const showFallback = !src || hasError
    const name = fallbackName ?? alt
    const initials = getInitials(name)
    const bgColor = getAvatarColor(name)

    return (
        <div
            className={cn("relative overflow-hidden rounded-full", className)}
            style={{ width: size, height: size }}
        >
            {showFallback ? (
                <div
                    className="flex items-center justify-center w-full h-full select-none"
                    style={{ backgroundColor: bgColor }}
                    aria-label={alt}
                    role="img"
                >
                    <span
                        className="font-semibold text-white leading-none"
                        style={{ fontSize: Math.max(size * 0.4, 12) }}
                    >
                        {initials}
                    </span>
                </div>
            ) : (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes={`${size}px`}
                    className="object-cover"
                    loading='lazy'
                    onError={() => setHasError(true)}
                />
            )}
        </div>
    )
}
