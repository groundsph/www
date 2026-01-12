"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface FollowCountsProps {
    userId: string
    username: string
    initialFollowers?: number
    initialFollowing?: number
    onCountsChange?: (followers: number, following: number) => void
}

export default function FollowCounts({
    userId,
    username,
    initialFollowers = 0,
    initialFollowing = 0,
    onCountsChange,
}: FollowCountsProps) {
    const [followers, setFollowers] = useState(initialFollowers)
    const [following, setFollowing] = useState(initialFollowing)
    const [isLoading, setIsLoading] = useState(false)

    // Fetch actual counts on mount
    useEffect(() => {
        const fetchCounts = async () => {
            setIsLoading(true)
            try {
                const { getFollowCounts } =
                    await import("@/app/api/actions/social")
                const counts = await getFollowCounts(userId)
                setFollowers(counts.followers)
                setFollowing(counts.following)
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
        setFollowers(initialFollowers)
        setFollowing(initialFollowing)
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

    return (
        <div className='flex items-center gap-4 text-sm'>
            <Link
                href={`/profile/${username}/followers`}
                className='hover:underline transition-colors group'
            >
                <span className={`font-bold ${isLoading ? "opacity-50" : ""}`}>
                    {formatCount(followers)}
                </span>{" "}
                <span className='text-text/60 group-hover:text-text/80'>
                    {followers === 1 ? "Follower" : "Followers"}
                </span>
            </Link>
            <span className='text-text/30'>•</span>
            <Link
                href={`/profile/${username}/following`}
                className='hover:underline transition-colors group'
            >
                <span className={`font-bold ${isLoading ? "opacity-50" : ""}`}>
                    {formatCount(following)}
                </span>{" "}
                <span className='text-text/60 group-hover:text-text/80'>
                    Following
                </span>
            </Link>
        </div>
    )
}
