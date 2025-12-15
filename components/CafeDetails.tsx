"use client"

import { Cafe } from "@/utils/types/cafe"
import Image from "next/image"
import { motion } from "motion/react"

export default function CafeDetails({ cafe }: { cafe: Cafe }) {
    // Render
    return (
        <section
            id='top'
            className='w-full min-h-[calc(100vh-20rem)] flex flex-col relative'
        >
            {/* Image */}
            <div className='absolute w-full h-full bg-linear-to-r from-black/70 to-transparent'>
                <Image
                    src={cafe.thumbnail}
                    alt=''
                    fill
                    className='object-cover object-center -z-1'
                />
            </div>
            {/* Details */}
            <div className='z-1 w-full h-full flex flex-col px-4 py-10 items-center text-background'>
                <div className='w-full max-w-7xl flex flex-col'>
                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 * 0 }}
                        className='text-2xl md:text-5xl font-bold'
                    >
                        {cafe.name}
                    </motion.h1>
                    <motion.h2
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 * 1 }}
                        className='font-serif font-semibold max-w-md'
                    >
                        {cafe.address_display}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 * 2 }}
                        className='max-w-md mt-8'
                    >
                        {cafe.description}
                    </motion.p>
                </div>
            </div>
        </section>
    )
}
