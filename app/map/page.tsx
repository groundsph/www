import { getAllCafes } from "@/app/api/actions/cafe"
import CafeMapWrapper from "@/components/CafeMapWrapper"
import { CafeWithRatings } from "@/utils/types/extra"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Map",
    description: "Explore the best cafes in Cebu on an interactive map.",
}

export default async function MapPage() {
    const cafes = (await getAllCafes(1, 100)) as CafeWithRatings[]

    return (
        <main className='w-full h-screen flex flex-col'>
            <div className='flex-1 w-full relative'>
                <CafeMapWrapper cafes={cafes} />
            </div>
        </main>
    )
}
