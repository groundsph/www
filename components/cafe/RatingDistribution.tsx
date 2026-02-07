"use client"

import { useState } from "react"

interface RatingDistributionProps {
    reviews: { rating: number }[]
    maxRating?: number
}

/**
 * Visual rating distribution chart with colorful bars
 * Shows count on hover
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

    // Calculate bar height (min 8px for visibility, max 64px)
    const getBarHeight = (count: number): number => {
        if (count === 0) return 8
        return Math.max(8, Math.round((count / maxCount) * 64))
    }

    if (reviews.length === 0) {
        return (
            <div className='bg-text/5 rounded-xl p-4'>
                <h3 className='font-semibold font-serif mb-3'>
                    Score Distribution
                </h3>
                <p className='text-sm text-text/50'>No reviews yet</p>
            </div>
        )
    }

    return (
        <div className='bg-text/5 rounded-xl p-4'>
            <h3 className='font-semibold font-serif mb-3'>
                Score Distribution
            </h3>
            <div className='bg-text/5 rounded-lg p-4'>
                <div className='flex items-end justify-between gap-2 h-20'>
                    {Array.from({ length: maxRating }, (_, i) => i + 1).map(
                        (rating) => {
                            const count = distribution[rating]
                            const height = getBarHeight(count)
                            const isHovered = hoveredRating === rating

                            return (
                                <div
                                    key={rating}
                                    className='flex-1 flex flex-col items-center gap-1 relative'
                                    onMouseEnter={() =>
                                        setHoveredRating(rating)
                                    }
                                    onMouseLeave={() => setHoveredRating(null)}
                                >
                                    {/* Tooltip */}
                                    {isHovered && (
                                        <div className='absolute -top-8 left-1/2 -translate-x-1/2 bg-text text-background text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-10'>
                                            {count}{" "}
                                            {count === 1 ? "review" : "reviews"}
                                        </div>
                                    )}
                                    {/* Bar */}
                                    <div
                                        className={`w-full max-w-6 rounded-full transition-all duration-200 cursor-pointer ${getBarColor(rating)} ${
                                            isHovered
                                                ? "opacity-100 scale-110"
                                                : "opacity-80"
                                        }`}
                                        style={{ height: `${height}px` }}
                                    />
                                    {/* Rating label */}
                                    <span className='text-[10px] text-text/50 font-medium'>
                                        {rating}
                                    </span>
                                </div>
                            )
                        }
                    )}
                </div>
            </div>
        </div>
    )
}
