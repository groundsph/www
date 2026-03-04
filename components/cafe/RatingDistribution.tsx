"use client"

import { useState } from "react"

interface RatingDistributionProps {
    reviews: { rating: number }[]
    maxRating?: number
}

/**
 * Visual rating distribution chart with horizontal stacked bars
 * Shows count always visible (no tooltip)
 */
export default function RatingDistribution({
    reviews,
    maxRating = 5,
}: RatingDistributionProps) {
    const [hoveredRating, setHoveredRating] = useState<number | null>(null)

    // Calculate distribution
    const distribution: Record<number, number> = {}
    for (let i = 1; i <= maxRating; i++) {
        distribution[i] = 0
    }
    reviews.forEach((review) => {
        if (review.rating >= 1 && review.rating <= maxRating) {
            distribution[review.rating]++
        }
    })

    // Find max count for scaling
    const maxCount = Math.max(...Object.values(distribution), 1)

    // Color gradient from red to green (1=red, 5=green)
    const getBarColor = (rating: number): string => {
        const colors: Record<number, string> = {
            1: "bg-red-500",
            2: "bg-orange-500",
            3: "bg-yellow-500",
            4: "bg-lime-500",
            5: "bg-green-500",
        }
        return colors[rating] || "bg-gray-500"
    }

    if (reviews.length === 0) {
        return <p className='text-xs text-text/50'>No reviews yet</p>
    }

    return (
        <div className='space-y-1.5'>
            {Array.from({ length: maxRating }, (_, i) => maxRating - i).map(
                (rating) => {
                    const count = distribution[rating]
                    const percentage =
                        maxCount > 0 ? (count / maxCount) * 100 : 0

                    return (
                        <div
                            key={rating}
                            className='flex items-center gap-2 text-xs'
                            onMouseEnter={() => setHoveredRating(rating)}
                            onMouseLeave={() => setHoveredRating(null)}
                        >
                            {/* Star number */}
                            <span className='w-3 text-right text-text/50 font-medium shrink-0 select-none'>
                                {rating}
                            </span>
                            {/* Bar track */}
                            <div className='flex-1 h-1.5 bg-text/10 rounded-full overflow-hidden'>
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${getBarColor(rating)}`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            {/* Count — always visible, no tooltip needed */}
                            <span className='w-4 text-right text-text/50 font-medium shrink-0 select-none'>
                                {count}
                            </span>
                        </div>
                    )
                }
            )}
        </div>
    )
}
