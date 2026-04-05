// app/map/page.tsx
import { getAllPublishedCafes } from "@/app/api/actions/cafe"
import CafeMapWrapper from "@/components/map/CafeMapWrapper"
import { CafeWithRatings } from "@/utils/types/extra"

export const dynamic = "force-dynamic"

export default async function MapPage() {
    const cafes = await getAllPublishedCafes() as CafeWithRatings[]
    return (
        <main className='w-full p-2 sm:p-4 md:p-6 h-[calc(100svh-3rem)] flex flex-col overflow-hidden'>
            <CafeMapWrapper cafes={cafes} />
        </main>
    )
}
