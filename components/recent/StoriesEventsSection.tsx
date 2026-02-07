"use client"

import { ArrowRightIcon, MapPinIcon } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { motion } from "motion/react"
import { BlogPost } from "@/utils/types/blog"
import { Event } from "@/utils/types/extra"

interface StoriesEventsSectionProps {
    latestPosts: BlogPost[]
    upcomingEvents: Event[]
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
        },
    },
} as const

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: "easeOut" },
    },
} as const

export default function StoriesEventsSection({
    latestPosts,
    upcomingEvents,
}: StoriesEventsSectionProps) {
    if (latestPosts.length === 0 && upcomingEvents.length === 0) return null

    return (
        <section className='w-full px-6 py-12 mb-8'>
            <div className='w-full grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16'>
                {/* Latest Stories */}
                {latestPosts.length > 0 && (
                    <motion.div
                        initial='hidden'
                        whileInView='visible'
                        viewport={{ once: true, margin: "-50px" }}
                        variants={containerVariants}
                        className='flex flex-col'
                    >
                        <motion.div
                            variants={itemVariants}
                            className='flex items-center justify-between mb-2'
                        >
                            <h2 className='font-semibold font-serif text-2xl'>
                                Latest Stories
                            </h2>
                            <Link
                                href='/blog'
                                className='text-primary text-sm font-medium hover:underline flex items-center gap-1'
                            >
                                Read more <ArrowRightIcon className='w-4 h-4' />
                            </Link>
                        </motion.div>
                        <div className='flex flex-col gap-4'>
                            {latestPosts.slice(0, 4).map((post) => (
                                <motion.div
                                    key={post.id}
                                    variants={itemVariants}
                                    whileHover={{ x: 4 }}
                                >
                                    <Link
                                        href={`/blog/${post.slug}`}
                                        className='group flex items-start gap-5 hover:opacity-80 transition-all hover:bg-secondary/10 py-2 px-2 rounded-xl'
                                    >
                                        <div className='flex flex-col gap-1 pt-1'>
                                            <span className='font-semibold text-lg md:text-xl group-hover:text-primary transition-colors line-clamp-2'>
                                                {post.title}
                                            </span>
                                            {post.excerpt && (
                                                <span className='text-text/50 text-sm line-clamp-2'>
                                                    {post.excerpt}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                    <motion.div
                        initial='hidden'
                        whileInView='visible'
                        viewport={{ once: true, margin: "-50px" }}
                        variants={containerVariants}
                        className='flex flex-col'
                    >
                        <motion.div
                            variants={itemVariants}
                            className='flex items-center justify-between mb-2'
                        >
                            <h2 className='font-semibold font-serif text-2xl'>
                                Upcoming Events
                            </h2>
                            <Link
                                href='/events'
                                className='text-primary text-sm font-medium hover:underline flex items-center gap-1'
                            >
                                View all <ArrowRightIcon className='w-4 h-4' />
                            </Link>
                        </motion.div>
                        <div className='flex flex-col gap-4'>
                            {upcomingEvents.slice(0, 4).map((event) => {
                                const startDate = new Date(event.start_date)
                                return (
                                    <motion.div
                                        key={event.id}
                                        variants={itemVariants}
                                        whileHover={{ x: 4 }}
                                    >
                                        <Link
                                            href='/events'
                                            className='group flex items-start gap-5 hover:opacity-80 transition-all hover:bg-secondary/10 py-2 px-2 rounded-xl'
                                        >
                                            <span className='font-serif text-3xl md:text-4xl font-bold text-text/30 group-hover:text-primary transition-colors min-w-12 text-right'>
                                                {format(startDate, "dd")}
                                            </span>
                                            <div className='flex flex-col gap-1 pt-1'>
                                                <span className='font-semibold text-lg md:text-xl group-hover:text-primary transition-colors line-clamp-2'>
                                                    {event.title}
                                                </span>
                                                <div className='flex flex-wrap items-center gap-2 text-text/50 text-sm'>
                                                    {event.location_name && (
                                                        <span className='flex items-center gap-1'>
                                                            <MapPinIcon className='w-3 h-3' />
                                                            {
                                                                event.location_name
                                                            }
                                                        </span>
                                                    )}
                                                    {event.is_national && (
                                                        <span className='bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full'>
                                                            National
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </motion.div>
                )}
            </div>
        </section>
    )
}
