"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface FollowCountsProps {
    userId: string
    username: string
    initialFollowers?: number
    initialFollowing?: number
    followersCount?: number
    followingCount?: number
    onCountsChange?: (followers: number, following: number) => void
    onFollowersClick?: () => void
    onFollowingClick?: () => void
}

export default function FollowCounts({
    userId,
    username,
    initialFollowers = 0,
    initialFollowing = 0,
    followersCount,
    followingCount,
    onCountsChange,
    onFollowersClick,
    onFollowingClick,
}: FollowCountsProps) {
    const [localFollowers, setLocalFollowers] = useState(initialFollowers)
    const [localFollowing, setLocalFollowing] = useState(initialFollowing)

    // Use controlled props if available, otherwise local state
    const displayFollowers = followersCount ?? localFollowers
    const displayFollowing = followingCount ?? localFollowing

    const [isLoading, setIsLoading] = useState(false)

    // Fetch actual counts on mount
    useEffect(() => {
        const fetchCounts = async () => {
            setIsLoading(true)
            try {
                const { getFollowCounts } =
                    await import("@/app/api/actions/social")
                const counts = await getFollowCounts(userId)
                setLocalFollowers(counts.followers)
                setLocalFollowing(counts.following)
                onCountsChange?.(counts.followers, counts.following)
            } catch (error) {
                console.error("Failed to fetch follow counts:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchCounts()
    }, [userId, onCountsChange])

    // Sync with prop changes (when parent refreshes)
    useEffect(() => {
        setLocalFollowers(initialFollowers)
        setLocalFollowing(initialFollowing)
    }, [initialFollowers, initialFollowing])

    const formatCount = (count: number) => {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`
        }
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`
        }
        return count.toString()
    }

    // Helper to render content
    const renderContent = (
        type: "followers" | "following",
        count: number,
        label: string
    ) => (
        <span className='flex items-center gap-1 group cursor-pointer'>
            <span className={`font-bold ${isLoading ? "opacity-50" : ""}`}>
                {formatCount(count)}
            </span>{" "}
            <span className='text-text/60 group-hover:text-text/80 transition-colors'>
                {label}
            </span>
        </span>
    )

    return (
        <div className='flex items-center gap-4 text-sm'>
            {onFollowersClick ? (
                <button
                    onClick={onFollowersClick}
                    className='hover:underline transition-colors focus:outline-none'
                >
                    {renderContent(
                        "followers",
                        displayFollowers,
                        displayFollowers === 1 ? "Follower" : "Followers"
                    )}
                </button>
            ) : (
                <Link
                    href={`/profile/${username}/followers`}
                    className='hover:underline transition-colors group'
                >
                    {renderContent(
                        "followers",
                        displayFollowers,
                        displayFollowers === 1 ? "Follower" : "Followers"
                    )}
                </Link>
            )}

            <span className='text-text/30'>•</span>

            {onFollowingClick ? (
                <button
                    onClick={onFollowingClick}
                    className='hover:underline transition-colors focus:outline-none'
                >
                    {renderContent("following", displayFollowing, "Following")}
                </button>
            ) : (
                <Link
                    href={`/profile/${username}/following`}
                    className='hover:underline transition-colors group'
                >
                    {renderContent("following", displayFollowing, "Following")}
                </Link>
            )}
        </div>
    )
}
