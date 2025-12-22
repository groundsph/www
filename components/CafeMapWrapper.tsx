"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { getCafesInBounds, MapBounds } from "@/app/api/actions/map"

const CafeMap = dynamic(() => import("@/components/CafeMap"), {
    ssr: false,
    loading: () => (
        <div className='w-full h-full min-h-[500px] flex items-center justify-center bg-secondary/20'>
            <p className='text-text/50 font-serif'>Loading map...</p>
        </div>
    ),
})

interface CafeMapWrapperProps {
    cafes: CafeWithRatings[]
}

export default function CafeMapWrapper({
    cafes: initialCafes,
}: CafeMapWrapperProps) {
    const [cafes, setCafes] = useState<CafeWithRatings[]>(initialCafes)
    const [isLoading, setIsLoading] = useState(false)

    const handleBoundsChange = useCallback(async (bounds: MapBounds) => {
        setIsLoading(true)
        try {
            const newCafes = await getCafesInBounds(bounds)
            setCafes(newCafes)
        } catch (error) {
            console.error("Failed to fetch cafes in bounds:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    return (
        <div className='relative w-full h-full'>
            <CafeMap
                cafes={cafes}
                onBoundsChange={handleBoundsChange}
            />
            {isLoading && (
                <div className='absolute top-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg z-50'>
                    <p className='text-text/70 text-sm font-serif'>
                        Loading cafes...
                    </p>
                </div>
            )}
        </div>
    )
}
