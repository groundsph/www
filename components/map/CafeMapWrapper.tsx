"use client"

import { useHaptics } from "@/hooks/useHaptics"
import { CafeWithRatings } from "@/utils/types/extra"
import { filterCafes } from "@/utils/map/client-filter"
import dynamic from "next/dynamic"
import { useState, useMemo, type ReactNode } from "react"
import { Store, Clock12, ChessBishop, DoorOpen } from "lucide-react"
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

/**
 * Filter toggle. Shows a short label on mobile and the full label from `sm` up,
 * so the buttons always communicate what they do even on narrow screens.
 */
function FilterButton({
    active,
    activeClassName,
    icon,
    label,
    shortLabel,
    onClick,
}: {
    active: boolean
    activeClassName: string
    icon: ReactNode
    label: string
    shortLabel: string
    onClick: () => void
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-lg transition-all cursor-pointer whitespace-nowrap ${
                active ? activeClassName : "bg-background text-text/80 hover:bg-text/5"
            }`}
        >
            <span className='shrink-0 flex items-center'>{icon}</span>
            {/* Visual labels only — the accessible name comes from aria-label. */}
            <span
                className='sm:hidden'
                aria-hidden='true'
            >
                {shortLabel}
            </span>
            <span
                className='hidden sm:inline'
                aria-hidden='true'
            >
                {label}
            </span>
        </button>
    )
}

export default function CafeMapWrapper({ cafes }: CafeMapWrapperProps) {
    const { trigger } = useHaptics()
    const [includeChains, setIncludeChains] = useState(false)
    const [is24_7, setIs24_7] = useState(false)
    const [isHalalCertified, setIsHalalCertified] = useState(false)
    const [isOpenNow, setIsOpenNow] = useState(false)

    // Derive the current PH day once per render (filters are applied client-side)
    const todayKey = useMemo(() => getPHDayKey(), [])

    // Apply all active filters purely in memory — no network calls
    const filteredCafes = useMemo(
        () =>
            filterCafes(cafes, {
                includeChains,
                is24_7,
                isHalalCertified,
                isOpenNow,
                todayKey,
            }),
        [cafes, includeChains, is24_7, isHalalCertified, isOpenNow, todayKey],
    )

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

    const toggleOpenNow = () => {
        trigger("selection")
        setIsOpenNow((prev) => !prev)
    }

    return (
        <div className='relative w-full h-full'>
            <CafeMap cafes={filteredCafes} />

            {/* Filter Buttons */}
            <div className='absolute top-4 right-4 z-10 flex flex-col items-end gap-2'>
                <FilterButton
                    active={isOpenNow}
                    activeClassName='bg-primary text-white'
                    icon={<DoorOpen className='w-4 h-4' />}
                    label='Open Now'
                    shortLabel='Open'
                    onClick={toggleOpenNow}
                />
                <FilterButton
                    active={is24_7}
                    activeClassName='bg-text text-background'
                    icon={<Clock12 className='w-4 h-4' />}
                    label='24 Hours'
                    shortLabel='24h'
                    onClick={toggle24_7}
                />
                <FilterButton
                    active={isHalalCertified}
                    activeClassName='bg-green-500 text-white'
                    icon={<ChessBishop className='w-4 h-4' />}
                    label='Halal Certified'
                    shortLabel='Halal'
                    onClick={toggleHalalCertified}
                />
                <FilterButton
                    active={includeChains}
                    activeClassName='bg-orange-500 text-white'
                    icon={<Store className='w-4 h-4' />}
                    label='Show Chains'
                    shortLabel='Chains'
                    onClick={toggleChains}
                />
            </div>
        </div>
    )
}
