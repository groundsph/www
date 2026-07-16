// app/map/page.tsx
import type { Metadata } from "next"
import { getAllPublishedCafes } from "@/app/api/actions/cafe"
import CafeMapWrapper from "@/components/map/CafeMapWrapper"
import { CafeWithRatings } from "@/utils/types/extra"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "Cafe Map | GroundsPH",
    description: "Explore cafes across the Philippines on an interactive map. Find coffee shops near you.",
    keywords: [
        "cafe map Philippines", "coffee shops near me",
        "find cafes on map", "cafe locations",
    ],
}

export default async function MapPage() {
    const cafes = await getAllPublishedCafes() as CafeWithRatings[]
    return (
        <main className='w-full p-2 sm:p-4 md:p-6 h-[calc(100svh-3rem)] flex flex-col overflow-hidden'>
            <CafeMapWrapper cafes={cafes} />
        </main>
    )
}
