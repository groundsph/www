"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/layout/AuthProvider"
import { getLandingFeedGroupedByCafe, type GroupedCafeFeed } from "@/app/api/actions/social"
import ActivityFeedSection from "@/components/feed/ActivityFeedSection"

export default function ActivityFeedWrapper() {
    const { user } = useAuth()
    const [groupedCheckIns, setGroupedCheckIns] = useState<GroupedCafeFeed[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // If not authenticated, don't fetch and hide section
        if (!user) {
            return
        }

        // Fetch grouped check-ins from followed users
        getLandingFeedGroupedByCafe(10)
            .then((data) => {
                setGroupedCheckIns(data.groupedCheckIns)
                setLoading(false)
            })
            .catch((error) => {
                console.error("Error fetching activity feed:", error)
                setGroupedCheckIns([])
                setLoading(false)
            })
    }, [user])

    // Hide if not authenticated or no check-ins available
    if (!user || (!loading && groupedCheckIns.length === 0)) {
        return null
    }

    // Show loading state while fetching
    if (loading) {
        return (
            <section className="w-full min-h-max flex flex-col mt-4">
                <div className="flex items-center justify-between px-6 mb-2">
                    <h2 className="font-semibold font-serif text-2xl">
                        Activity Feed
                    </h2>
                    <p className="text-sm text-text/60">
                        From people you follow
                    </p>
                </div>
                <div className="flex flex-row gap-4 min-w-full overflow-x-auto px-4 pt-4 pb-10">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className="shrink-0 w-[320px] h-48 bg-text/5 rounded-xl animate-pulse"
                        />
                    ))}
                </div>
            </section>
        )
    }

    return <ActivityFeedSection variant="landing" groupedCheckIns={groupedCheckIns} />
}
