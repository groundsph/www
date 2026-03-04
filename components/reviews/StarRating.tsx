"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { StarIcon } from "lucide-react"
import { useState } from "react"

interface StarRatingProps {
    totalStars?: number
    rating: number
    onRatingChange?: (rating: number) => void
    size?: "sm" | "md" | "lg"
    readOnly?: boolean
}

export default function StarRating({
    totalStars = 5,
    rating,
    onRatingChange,
    size = "md",
    readOnly = false,
}: StarRatingProps) {
    const { trigger } = useHaptics()
    const [hoverRating, setHoverRating] = useState<number | null>(null)

    const handleMouseEnter = (index: number) => {
        if (!readOnly) {
            setHoverRating(index + 1)
        }
    }

    const handleMouseLeave = () => {
        if (!readOnly) {
            setHoverRating(null)
        }
    }

    const handleClick = (index: number) => {
        if (!readOnly && onRatingChange) {
            trigger("rigid")
            onRatingChange(index + 1)
        }
    }

    const sizeClasses = {
        sm: "w-4 h-4",
        md: "w-6 h-6",
        lg: "w-8 h-8",
    }

    return (
        <div
            className='flex flex-row items-center cursor-pointer'
            onMouseLeave={handleMouseLeave}
        >
            {Array.from({ length: totalStars }).map((_, index) => {
                const isFilled = (hoverRating ?? rating) > index

                return (
                    <div
                        key={index}
                        className={`p-0.5 transition-transform ${!readOnly && "hover:scale-110 active:scale-95"}`}
                        onMouseEnter={() => handleMouseEnter(index)}
                        onClick={() => handleClick(index)}
                    >
                        <StarIcon
                            className={`${sizeClasses[size]} ${
                                isFilled
                                    ? "fill-primary text-primary"
                                    : "fill-transparent text-text opacity-20"
                            } transition-colors duration-200`}
                        />
                    </div>
                )
            })}
        </div>
    )
}
