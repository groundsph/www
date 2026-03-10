"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { CafeWithRatings } from "@/utils/types/extra"
import dynamic from "next/dynamic"
import { useState, useMemo } from "react"
import { Store, Clock12 } from "lucide-react"
import { getPHDayKey } from "@/utils/time"

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

export default function CafeMapWrapper({ cafes }: CafeMapWrapperProps) {
    const { trigger } = useHaptics()
    const [includeChains, setIncludeChains] = useState(false)
    const [is24_7, setIs24_7] = useState(false)
    const [isHalalCertified, setIsHalalCertified] = useState(false)

    // Derive the current PH day once per render (filters are applied client-side)
    const todayKey = useMemo(() => getPHDayKey(), [])

    // Apply all active filters purely in memory — no network calls
    const filteredCafes = useMemo(() => {
        return cafes.filter((cafe) => {
            // Chain filter: exclude chains unless toggled on
            if (!includeChains && cafe.is_chain === true) return false

            // 24/7 filter: check operating_hours for today's entry with is_24_hours === true
            if (is24_7) {
                const hours = cafe.operating_hours
                if (!Array.isArray(hours)) return false
                const todayEntry = hours.find(
                    (h: { day: string; is_24_hours?: boolean }) => h.day === todayKey
                )
                if (!todayEntry?.is_24_hours) return false
            }

            // Halal filter
            if (isHalalCertified && !cafe.is_halal_certified) return false

            return true
        })
    }, [cafes, includeChains, is24_7, isHalalCertified, todayKey])

    const toggleChains = () => {
        trigger("selection")
        setIncludeChains((prev) => !prev)
    }

    const toggle24_7 = () => {
        trigger("selection")
        setIs24_7((prev) => !prev)
    }

    const toggleHalalCertified = () => {
        trigger("selection")
        setIsHalalCertified((prev) => !prev)
    }

    return (
        <div className='relative w-full h-full'>
            <CafeMap cafes={filteredCafes} />

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
                    <span className='hidden sm:inline'>24 Hours</span>
                </button>
                <button
                    onClick={toggleHalalCertified}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all cursor-pointer ${
                        isHalalCertified
                            ? "bg-green-500 text-white"
                            : "bg-background text-text/80 hover:bg-text/5"
                    }`}
                >
                    <span className='hidden sm:inline'>Halal Certified</span>
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
        </div>
    )
}
