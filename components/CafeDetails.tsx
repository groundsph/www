"use client"

import { Cafe } from "@/utils/types/cafe"
import { useCallback, useEffect, useState } from "react"
import Loading from "./Loading"
import Image from "next/image"
import { motion } from "motion/react"
import Link from "next/link"
import { getCafeBySlug } from "@/utils/dummy/cafes"

export default function CafeDetails({ cafeSlug }: { cafeSlug: string }) {
    // Constants
    // States
    const [cafe, setCafe] = useState<Cafe | null>(null)
    const [loading, setLoading] = useState(true)
    // Functions
    const initializePage = useCallback(async () => {
        const cafe = await getCafeBySlug(cafeSlug)
        if (cafe) {
            setCafe(cafe)
            setLoading(false)
        }
    }, [cafeSlug, setLoading, setCafe])
    // Effects
    useEffect(() => {
        initializePage()
    }, [initializePage])
    // Render
    if (loading) return <Loading />
    if (!cafe)
        return (
            <section
                id='not-found'
                className='w-full h-full flex flex-col items-center justify-center flex-1'
            >
                <h1 className='text-5xl font-bold'>404</h1>
                <p className='text-2xl font-semibold'>Page Not Found</p>
                <p className='text-xl'>
                    The page you are looking for does not exist.
                </p>
                <Link
                    href='/'
                    className='text-sm font-semibold underline transition-colors hover:text-text/60'
                >
                    Go Back Home
                </Link>
            </section>
        )
    return (
        <section
            id='top'
            className='w-full min-h-[calc(100vh-20rem)] flex flex-col relative'
        >
            {/* Image */}
            <div className='absolute w-full h-full bg-linear-to-r from-black/70 to-transparent'>
                <Image
                    src={cafe?.thumbnail}
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
