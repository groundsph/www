"use client"

import dynamic from "next/dynamic"

const CrawlRouteMapInternal = dynamic(
    () => import("./CrawlRouteMapInternal"),
    {
        ssr: false,
        loading: () => (
            <div
                className='w-full h-full flex items-center justify-center bg-secondary/20'
                style={{ minHeight: "420px" }}
            >
                <p className='text-text/50 font-serif'>Loading map...</p>
            </div>
        ),
    }
)

interface CrawlRouteMapProps {
    points: { lat: number; lng: number; imageUrl?: string | null; label?: string; index?: number }[]
    focusPoint?: { lat: number; lng: number } | null
    showUserLocation?: boolean
}

export default function CrawlRouteMap({ points, focusPoint, showUserLocation }: CrawlRouteMapProps) {
    return <CrawlRouteMapInternal points={points} focusPoint={focusPoint} showUserLocation={showUserLocation} />
}
