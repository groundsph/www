"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import dynamic from "next/dynamic"

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

export default function CafeMapWrapper({ cafes }: CafeMapWrapperProps) {
    return <CafeMap cafes={cafes} />
}
