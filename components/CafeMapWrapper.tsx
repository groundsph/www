"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import dynamic from "next/dynamic"
import { useState, useCallback, useRef } from "react"
import { getCafesInBounds, MapBounds } from "@/app/api/actions/map"
import { Store } from "lucide-react"

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
    const [includeChains, setIncludeChains] = useState(false)
    const lastBoundsRef = useRef<MapBounds | null>(null)

    const handleBoundsChange = useCallback(
        async (bounds: MapBounds) => {
            lastBoundsRef.current = bounds
            setIsLoading(true)
            try {
                const newCafes = await getCafesInBounds({
                    ...bounds,
                    includeChains,
                })
                setCafes(newCafes)
            } catch (error) {
                console.error("Failed to fetch cafes in bounds:", error)
            } finally {
                setIsLoading(false)
            }
        },
        [includeChains]
    )

    // Toggle chain visibility and refetch
    const toggleChains = useCallback(async () => {
        const newIncludeChains = !includeChains
        setIncludeChains(newIncludeChains)

        if (lastBoundsRef.current) {
            setIsLoading(true)
            try {
                const newCafes = await getCafesInBounds({
                    ...lastBoundsRef.current,
                    includeChains: newIncludeChains,
                })
                setCafes(newCafes)
            } catch (error) {
                console.error("Failed to fetch cafes in bounds:", error)
            } finally {
                setIsLoading(false)
            }
        }
    }, [includeChains])

    return (
        <div className='relative w-full h-full'>
            <CafeMap
                cafes={cafes}
                onBoundsChange={handleBoundsChange}
            />

            {/* Show Chain Cafes Toggle */}
            <div className='absolute top-4 right-4 z-50'>
                <button
                    onClick={toggleChains}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all cursor-pointer ${
                        includeChains
                            ? "bg-orange-500 text-white"
                            : "bg-background text-text/80 hover:bg-text/5"
                    }`}
                >
                    <Store className='w-4 h-4' />
                    <span className='hidden sm:inline'>
                        {includeChains ? "Hiding Chains" : "Show Chains"}
                    </span>
                </button>
            </div>

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
