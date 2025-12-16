"use client"

import dynamic from "next/dynamic"
import { Cafe } from "@/utils/types/cafe"

const CafeMiniMapInternal = dynamic(() => import("./CafeMiniMapInternal"), {
    ssr: false,
    loading: () => (
        <div className='w-full h-full min-h-[180px] flex items-center justify-center bg-secondary/20 rounded-xl'>
            <p className='text-text/50 font-serif text-sm'>Loading map...</p>
        </div>
    ),
})

interface CafeMiniMapProps {
    cafe: Cafe
}

export default function CafeMiniMap({ cafe }: CafeMiniMapProps) {
    return <CafeMiniMapInternal cafe={cafe} />
}
