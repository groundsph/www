"use client"

import { useMemo } from "react"
import Image from "next/image"
import { getLucideIcon } from "./iconUtils"

// Badge metadata structure for icon-based badges
interface BadgeMetadata {
    icon_name?: string
    icon_color?: string
}

// Minimal badge interface compatible with both database types and BadgeDefinition
interface Badge {
    id: string
    name: string
    description: string
    image_url: string
    category: "achievement" | "monetary" | "social"
    rarity: "common" | "rare" | "legendary"
    metadata?: BadgeMetadata | null
}

interface BadgeCardProps {
    badge: Badge
    size?: "sm" | "md" | "lg"
    showDetails?: boolean
    isAdmin?: boolean
    onEdit?: () => void
    onDelete?: () => void
}

const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
}

const rarityStyles = {
    common: "border-2 border-text/20",
    rare: "border-2 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]",
    legendary:
        "border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)] animate-pulse",
}

const rarityLabels = {
    common: { text: "Common", color: "text-text/60" },
    rare: { text: "Rare", color: "text-blue-500" },
    legendary: { text: "Legendary", color: "text-amber-500" },
}

const categoryLabels = {
    achievement: "Achievement",
    monetary: "Supporter",
    social: "Social",
}

export default function BadgeCard({
    badge,
    size = "md",
    showDetails = false,
    isAdmin = false,
    onEdit,
    onDelete,
}: BadgeCardProps) {
    // Check if this badge uses a Lucide icon
    const metadata = badge.metadata as BadgeMetadata | null | undefined
    const iconName = metadata?.icon_name
    const iconColor = metadata?.icon_color || "#8B4513"
    // Memoize icon component lookup to avoid creating during render
    const IconComponent = useMemo(
        () => (iconName ? getLucideIcon(iconName) : null),
        [iconName]
    )

    const iconSize = size === "lg" ? 32 : size === "md" ? 24 : 16

    return (
        <div className='group relative'>
            {/* Badge Image/Icon Container */}
            <div
                className={`
                    ${sizeClasses[size]} 
                    ${rarityStyles[badge.rarity]} 
                    rounded-full overflow-hidden bg-background
                    flex items-center justify-center
                    transition-transform duration-200
                    ${showDetails ? "group-hover:scale-105" : ""}
                `}
                title={
                    showDetails
                        ? undefined
                        : `${badge.name} - ${badge.description}`
                }
            >
                {IconComponent ? (
                    /* eslint-disable-next-line react-hooks/static-components -- Dynamic icon rendering is intentional */
                    <IconComponent
                        style={{ color: iconColor }}
                        className={`w-${iconSize === 32 ? 8 : iconSize === 24 ? 6 : 4} h-${iconSize === 32 ? 8 : iconSize === 24 ? 6 : 4}`}
                    />
                ) : (
                    <Image
                        src={badge.image_url}
                        alt={badge.name}
                        width={size === "lg" ? 64 : size === "md" ? 48 : 32}
                        height={size === "lg" ? 64 : size === "md" ? 48 : 32}
                        className='object-contain'
                        unoptimized
                    />
                )}
            </div>

            {/* Details Section (for admin view) */}
            {showDetails && (
                <div className='mt-2 text-center'>
                    <p className='text-sm font-medium text-text truncate max-w-[100px]'>
                        {badge.name}
                    </p>
                    <p
                        className={`text-xs ${rarityLabels[badge.rarity].color}`}
                    >
                        {rarityLabels[badge.rarity].text}
                    </p>
                </div>
            )}

            {/* Admin Actions */}
            {isAdmin && (onEdit || onDelete) && (
                <div className='absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1'>
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className='p-1 bg-primary text-white rounded-full hover:bg-primary/80 transition-colors'
                            title='Edit badge'
                        >
                            <svg
                                className='w-3 h-3'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                />
                            </svg>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className='p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors'
                            title='Delete badge'
                        >
                            <svg
                                className='w-3 h-3'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                                />
                            </svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// Full badge card for admin list view
export function BadgeCardFull({
    badge,
    onEdit,
    onDelete,
    onAward,
}: {
    badge: Badge
    onEdit?: () => void
    onDelete?: () => void
    onAward?: () => void
}) {
    // Check if this badge uses a Lucide icon
    const metadata = badge.metadata as BadgeMetadata | null | undefined
    const iconName = metadata?.icon_name
    const iconColor = metadata?.icon_color || "#8B4513"
    // Memoize icon component lookup to avoid creating during render
    const IconComponent = useMemo(
        () => (iconName ? getLucideIcon(iconName) : null),
        [iconName]
    )

    return (
        <div className='group relative bg-text/5 border border-text/10 rounded-xl p-4 hover:border-text/20 transition-colors'>
            <div className='flex items-start gap-4'>
                {/* Badge Image/Icon */}
                <div
                    className={`
                        w-16 h-16 shrink-0
                        ${rarityStyles[badge.rarity]} 
                        rounded-full overflow-hidden bg-background
                        flex items-center justify-center
                    `}
                >
                    {IconComponent ? (
                        /* eslint-disable-next-line react-hooks/static-components -- Dynamic icon rendering is intentional */
                        <IconComponent
                            style={{ color: iconColor }}
                            className='w-8 h-8'
                        />
                    ) : (
                        <Image
                            src={badge.image_url}
                            alt={badge.name}
                            width={64}
                            height={64}
                            className='object-contain'
                            unoptimized
                        />
                    )}
                </div>

                {/* Badge Info */}
                <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                        <h3 className='text-lg font-semibold text-text truncate'>
                            {badge.name}
                        </h3>
                        <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                badge.rarity === "legendary"
                                    ? "bg-amber-500/20 text-amber-600"
                                    : badge.rarity === "rare"
                                      ? "bg-blue-500/20 text-blue-600"
                                      : "bg-text/10 text-text/60"
                            }`}
                        >
                            {rarityLabels[badge.rarity].text}
                        </span>
                    </div>
                    <p className='text-sm text-text/70 line-clamp-2 mb-2'>
                        {badge.description}
                    </p>
                    <span className='text-xs text-text/50 bg-text/5 px-2 py-1 rounded'>
                        {categoryLabels[badge.category]}
                    </span>
                </div>

                {/* Actions */}
                <div className='flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                    {onAward && (
                        <button
                            onClick={onAward}
                            className='p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors'
                            title='Award to users'
                        >
                            <svg
                                className='w-4 h-4'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM12.75 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'
                                />
                            </svg>
                        </button>
                    )}
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className='p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors'
                            title='Edit badge'
                        >
                            <svg
                                className='w-4 h-4'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                                />
                            </svg>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className='p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors'
                            title='Delete badge'
                        >
                            <svg
                                className='w-4 h-4'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                                />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
