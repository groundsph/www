"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import dynamic from "next/dynamic"
import { useState, useCallback, useRef } from "react"
import { getCafesInBounds, MapBounds } from "@/app/api/actions/map"
import { Store, Clock12 } from "lucide-react"

const CafeMap = dynamic(() => import("@/components/map/CafeMap"), {
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
    const [is24_7, setIs24_7] = useState(false)
    const [isHalalCertified, setIsHalalCertified] = useState(false)
    const lastBoundsRef = useRef<MapBounds | null>(null)

    const handleBoundsChange = useCallback(
        async (bounds: MapBounds) => {
            lastBoundsRef.current = bounds
            setIsLoading(true)
            try {
                const newCafes = await getCafesInBounds({
                    ...bounds,
                    includeChains,
                    is_24_7: is24_7,
                    isHalalCertified,
                })
                setCafes(newCafes)
            } catch (error) {
                console.error("Failed to fetch cafes in bounds:", error)
            } finally {
                setIsLoading(false)
            }
        },
        [includeChains, is24_7, isHalalCertified]
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
                    is_24_7: is24_7,
                    isHalalCertified,
                })
                setCafes(newCafes)
            } catch (error) {
                console.error("Failed to fetch cafes in bounds:", error)
            } finally {
                setIsLoading(false)
            }
        }
    }, [includeChains, is24_7, isHalalCertified])

    // Toggle 24/7 filter and refetch
    const toggle24_7 = useCallback(async () => {
        const newIs24_7 = !is24_7
        setIs24_7(newIs24_7)

        if (lastBoundsRef.current) {
            setIsLoading(true)
            try {
                const newCafes = await getCafesInBounds({
                    ...lastBoundsRef.current,
                    includeChains,
                    is_24_7: newIs24_7,
                    isHalalCertified,
                })
                setCafes(newCafes)
            } catch (error) {
                console.error("Failed to fetch cafes in bounds:", error)
            } finally {
                setIsLoading(false)
            }
        }
    }, [is24_7, includeChains, isHalalCertified])

    // Toggle Halal Certified filter and refetch
    const toggleHalalCertified = useCallback(async () => {
        const newIsHalalCertified = !isHalalCertified
        setIsHalalCertified(newIsHalalCertified)

        if (lastBoundsRef.current) {
            setIsLoading(true)
            try {
                const newCafes = await getCafesInBounds({
                    ...lastBoundsRef.current,
                    includeChains,
                    is_24_7: is24_7,
                    isHalalCertified: newIsHalalCertified,
                })
                setCafes(newCafes)
            } catch (error) {
                console.error("Failed to fetch cafes in bounds:", error)
            } finally {
                setIsLoading(false)
            }
        }
    }, [isHalalCertified, includeChains, is24_7])

    return (
        <div className='relative w-full h-full'>
            <CafeMap
                cafes={cafes}
                onBoundsChange={handleBoundsChange}
            />

            {/* Filter Buttons */}
            <div className='absolute top-4 right-4 z-50 flex flex-col gap-2'>
                <button
                    onClick={toggle24_7}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all cursor-pointer ${
                        is24_7
                            ? "bg-text text-background"
                            : "bg-background text-text/80 hover:bg-text/5"
                    }`}
                >
                    <Clock12 className='w-4 h-4' />
                    <span className='hidden sm:inline'>
                        24 Hours
                    </span>
                </button>
                <button
                    onClick={toggleHalalCertified}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all cursor-pointer ${
                        isHalalCertified
                            ? "bg-green-500 text-white"
                            : "bg-background text-text/80 hover:bg-text/5"
                    }`}
                >
                    <span className='hidden sm:inline'>
                        Halal Certified
                    </span>
                </button>
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
