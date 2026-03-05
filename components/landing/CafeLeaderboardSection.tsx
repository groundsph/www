"use client"

import { CrownIcon } from "lucide-react"
import { motion } from "motion/react"
import Image from "next/image"

export default function CafeLeaderboardSection() {
    return (
        <section
            id='cafe-leaderboard'
            className='w-full px-6 py-12 mb-8 space-y-2'
        >
            <motion.h2
                initial={{ opacity: 0 }}
                whileInView={{
                    opacity: 1,
                    transition: { duration: 0.6, ease: "easeOut" },
                }}
                viewport={{ once: true, margin: "-50px" }}
                className='font-semibold font-serif text-2xl'
            >
                Community Favorites
            </motion.h2>
            <div className='flex flex-col md:flex-row gap-4 w-full'>
                {/* 1st */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{
                        opacity: 1,
                        y: 0,
                        transition: {
                            duration: 0.6,
                            ease: "easeOut",
                            delay: 0.1,
                        },
                    }}
                    viewport={{ once: true, margin: "-50px" }}
                    className='relative aspect-video h-auto w-full md:w-3/5 rounded-xl overflow-clip shadow-md'
                >
                    <div className='absolute left-2 top-4 z-1 bg-background px-3 py-1 pl-12 rounded-full text-xs md:text-sm font-semibold shadow-md'>
                        <div className='w-10 h-10 p-2 absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-linear-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-sm'>
                            <CrownIcon className='w-full' />
                        </div>
                        Top Cafe of the Month
                    </div>
                    <Image
                        src='https://cdn.grounds.ph/cafes/placeholder.jpg'
                        alt=''
                        fill
                        className='object-cover'
                    />
                </motion.div>
                {/* 2nd & 3rd */}
                <div className='flex flex-col gap-4 flex-1 w-full md:w-auto'>
                    {new Array(2).fill(0).map((_, idx) => (
                        <motion.a
                            href='/'
                            key={idx + "cflead"}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{
                                opacity: 1,
                                y: 0,
                                transition: {
                                    duration: 0.6,
                                    ease: "easeOut",
                                    delay: 0.2 * (idx + 1),
                                },
                            }}
                            viewport={{ once: true, margin: "-50px" }}
                            whileHover={{
                                y: -5,
                                transition: {
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20,
                                },
                            }}
                            className='relative md:aspect-auto bg-text/5 rounded-xl border-text/5 border p-4 cursor-pointer hover:bg-text/10 hover:border-text/10 transition-colors flex flex-row gap-2'
                        >
                            <div
                                className={`aspect-square rounded-full absolute top-2 left-2 w-8 h-8 flex items-center justify-center z-1 bg-linear-to-br font-semibold text-white ${idx === 0 ? "from-gray-400 to-gray-500" : "from-amber-700 to-amber-800"}`}
                            >
                                {idx + 2}
                            </div>
                            <div className='relative bg-accent h-auto max-w-2/5 aspect-4/3 rounded-lg overflow-clip flex-1'>
                                <Image
                                    src='https://cdn.grounds.ph/cafes/placeholder.jpg'
                                    alt=''
                                    fill
                                    className='object-cover'
                                />
                            </div>
                        </motion.a>
                    ))}
                </div>
            </div>
        </section>
    )
}
