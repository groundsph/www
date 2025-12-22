"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import { ArrowRightIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"

export default function RecentCard({
    cafe,
    idx,
}: {
    cafe: CafeWithRatings
    idx: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: idx * 0.4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className='min-w-full md:min-w-80 md:w-80 snap-center md:snap-start flex flex-col gap-2 bg-background border-text/10 border shadow-sm  rounded-4xl p-4'
        >
            <div className='relative rounded-3xl overflow-clip w-full h-auto aspect-square select-none bg-secondary/10'>
                {cafe.thumbnail && (
                    <Image
                        src={cafe.thumbnail}
                        alt=''
                        fill
                        className='object-cover'
                        draggable={false}
                    />
                )}
            </div>
            <span className='font-semibold text-xl'>{cafe.name}</span>
            <span className='text-text/60 text-sm'>{cafe.address_display}</span>
            <div className='flex-1' />
            {cafe.slug && (
                <Link
                    href={`/cafes/${cafe.slug}`}
                    className='flex flex-row justify-end items-center gap-2 hover:opacity-60 transition-opacity'
                >
                    Learn More <ArrowRightIcon className='w-4 h-4' />
                </Link>
            )}
        </motion.div>
    )
}
