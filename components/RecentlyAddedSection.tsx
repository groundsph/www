"use client"

import { useInView } from "motion/react"
import { useRef } from "react"
import RecentCard from "./RecentCard"
import { CafeWithRatings } from "@/utils/types/extra"

export default function RecentlyAddedSection({
    cafes,
}: {
    cafes: CafeWithRatings[]
}) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    return (
        <section
            className='w-full min-h-max flex flex-col mt-4'
            ref={ref}
        >
            <h2 className='font-semibold font-serif text-2xl px-6'>
                Recently Added Cafes
            </h2>
            <div className='flex flex-row gap-8 min-w-full overflow-x-auto overscroll-x-contain px-4 pt-4 pb-10 snap-x snap-mandatory scroll-px-4'>
                {cafes.map((cafe, idx) => (
                    <RecentCard
                        key={cafe.id || idx}
                        cafe={cafe}
                        idx={idx}
                        animate={isInView}
                    />
                ))}
            </div>
        </section>
    )
}
