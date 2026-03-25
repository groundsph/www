"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { useState, useCallback, useEffect } from "react"
import { UserPlus, UserMinus, Loader2, Lock, Check } from "lucide-react"

interface FollowButtonProps {
    targetUserId: string
    initialIsFollowing?: boolean
    initialHasPendingRequest?: boolean
    isPrivate?: boolean
    size?: "sm" | "md" | "lg"
    className?: string
    onFollowChange?: (isFollowing: boolean) => void
    onRequestSent?: () => void
}

export default function FollowButton({
    targetUserId,
    initialIsFollowing = false,
    initialHasPendingRequest = false,
    isPrivate = false,
    size = "md",
    className = "",
    onFollowChange,
    onRequestSent,
}: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
    const [hasPendingRequest, setHasPendingRequest] = useState(initialHasPendingRequest)
    const [isLoading, setIsLoading] = useState(false)
    const [isHovering, setIsHovering] = useState(false)
    const { trigger } = useHaptics()

    // Sync with prop changes
    useEffect(() => {
        setIsFollowing(initialIsFollowing)
    }, [initialIsFollowing])

    useEffect(() => {
        setHasPendingRequest(initialHasPendingRequest)
    }, [initialHasPendingRequest])

    const handleClick = useCallback(async () => {
        trigger(isFollowing ? "soft" : "medium")
        setIsLoading(true)
        try {
            if (isFollowing) {
                const { unfollowUser } =
                    await import("@/app/api/actions/social")
                const result = await unfollowUser(targetUserId)
                if (result.success) {
                    setIsFollowing(false)
                    onFollowChange?.(false)
                }
            } else {
                const { followUser } = await import("@/app/api/actions/social")
                const result = await followUser(targetUserId)
                if (result.success) {
                    if (result.requiresApproval) {
                        setHasPendingRequest(true)
                        onRequestSent?.()
                    } else {
                        setIsFollowing(true)
                        onFollowChange?.(true)
                    }
                }
            }
        } catch (error) {
            console.error("Follow action failed:", error)
        } finally {
            setIsLoading(false)
        }
    }, [isFollowing, targetUserId, onFollowChange, onRequestSent, trigger])

    // Size variants
    const sizeClasses = {
        sm: "px-3 py-1.5 text-xs gap-1",
        md: "px-4 py-2 text-sm gap-1.5",
        lg: "px-5 py-2.5 text-base gap-2",
    }

    const iconSizes = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-5 h-5",
    }

    // Button styles based on state
    const getButtonStyles = () => {
        if (hasPendingRequest) {
            return "bg-amber-500/10 text-amber-600 border-amber-500/30 cursor-default"
        }
        if (isFollowing) {
            if (isHovering) {
                // Hovering on "Following" shows "Unfollow" style
                return "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
            }
            return "bg-text/5 text-text border-text/20 hover:bg-text/10"
        }
        return "bg-primary text-white border-primary hover:bg-primary/90"
    }

    const getLabel = () => {
        if (hasPendingRequest) {
            return "Requested"
        }
        if (isFollowing) {
            return isHovering ? "Unfollow" : "Following"
        }
        return "Follow"
    }

    const getIcon = () => {
        if (isLoading) {
            return <Loader2 className={`${iconSizes[size]} animate-spin`} />
        }
        if (hasPendingRequest) {
            return <Check className={iconSizes[size]} />
        }
        if (isFollowing && isHovering) {
            return <UserMinus className={iconSizes[size]} />
        }
        if (!isFollowing) {
            if (isPrivate) {
                return <Lock className={iconSizes[size]} />
            }
            return <UserPlus className={iconSizes[size]} />
        }
        return null
    }

    return (
        <button
            onClick={handleClick}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            disabled={isLoading || hasPendingRequest}
            className={`inline-flex items-center justify-center font-semibold rounded-full border transition-all duration-200 ${sizeClasses[size]} ${getButtonStyles()} disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        >
            {getIcon()}
            <span>{getLabel()}</span>
        </button>
    )
}
