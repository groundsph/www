"use client"

import { MapPinIcon, Coffee } from "lucide-react"
import Link from "next/link"
import { motion } from "motion/react"

const MotionLink = motion.create(Link)

export default function SubmitCafeSection({
    cafeCount,
}: {
    cafeCount: number
}) {
    return (
        <section className='w-full bg-linear-to-br from-secondary via-primary/80 to-secondary py-12 px-6 flex flex-col items-center justify-center gap-4 overflow-hidden relative'>
            {/* Background decorations */}
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.1 }}
                viewport={{ once: true }}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.5, ease: "easeOut", repeat: Infinity, repeatDelay: 1 }}
                className='absolute left-8 bottom-4 -rotate-12'
            >
                <MapPinIcon className='h-32 w-32 text-background' />
            </motion.div>
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.1 }}
                viewport={{ once: true }}
                animate={{ y: [0, 15, 0], rotate: [6, 4, 6] }}
                transition={{ duration: 5, repeat: Infinity, repeatDelay: 0.5, ease: "easeInOut" }}
                className='absolute right-12 top-8'
            >
                <Coffee className='h-24 w-24 text-background' />
            </motion.div>

            {/* Content */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className='text-center z-10'
            >
                <h2 className='font-serif text-3xl md:text-4xl font-bold text-background mb-3'>
                    Found a spot we missed?
                </h2>
                <p className='max-w-md mx-auto text-background/90 mb-6'>
                    We currently have{" "}
                    <span className='font-bold text-tertiary'>
                        {cafeCount} cafes
                    </span>{" "}
                    in our catalogue waiting for you to browse. Help the
                    community grow by sharing your favorite spots.
                </p>
                <MotionLink
                    href='/submit'
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className='inline-flex items-center gap-2 px-6 py-3 bg-background text-primary font-semibold rounded-xl hover:bg-background/90 transition-colors shadow-lg hover:shadow-xl'
                >
                    <MapPinIcon className='w-5 h-5' />
                    Submit a Cafe
                </MotionLink>
            </motion.div>
        </section>
    )
}
