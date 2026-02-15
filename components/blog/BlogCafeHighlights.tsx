"use client"

import { CafeWithRatings } from "@/utils/types/extra"
import { ArrowRightIcon, MapPinIcon, Coffee, Star } from "lucide-react"
import Image from "next/image"
import { motion } from "motion/react"
import { getCafeThumbnailUrl } from "@/utils/extras"
import { useState } from "react"
import Link from "next/link"

interface BlogCafeHighlightsProps {
    cafes: CafeWithRatings[]
}

function CafeHighlightCard({
    cafe,
    idx,
}: {
    cafe: CafeWithRatings
    idx: number
}) {
    const [imageLoaded, setImageLoaded] = useState(false)

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.6, ease: "easeOut" }}
        >
            <Link
                href={`/cafes/${cafe.slug}`}
                className="flex flex-col bg-background hover:bg-tertiary/60 border border-secondary/20 hover:border-secondary/40 shadow-sm hover:shadow-md rounded-2xl overflow-hidden group transition-all duration-300 h-full"
            >
                {/* Image Container */}
                <div className="relative w-full aspect-4/3 select-none overflow-hidden"
                >
                    {/* Skeleton loader */}
                    <div
                        className={`absolute inset-0 bg-secondary/20 transition-opacity duration-500 ${imageLoaded ? "opacity-0" : "opacity-100"}`}
                    >
                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-secondary/30 to-transparent animate-shimmer" />
                        <div className="w-full h-full flex items-center justify-center">
                            <Coffee className="w-8 h-8 text-secondary/40" />
                        </div>
                    </div>

                    {cafe.thumbnail ? (
                        <Image
                            src={getCafeThumbnailUrl(cafe.thumbnail)}
                            alt={cafe.name}
                            fill
                            className={`object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                            draggable={false}
                            sizes="(max-width: 768px) 85vw, (max-width: 1200px) 33vw, 25vw"
                            onLoad={() => setImageLoaded(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-secondary/30 to-primary/20">
                            <Coffee className="w-12 h-12 text-primary/40" />
                        </div>
                    )}

                    {/* Warm overlay gradient */}
                    <div className="absolute inset-0 bg-linear-to-t from-text/40 via-transparent to-transparent opacity-60" />

                    {/* Rating badge */}
                    {cafe.average_rating && cafe.average_rating > 0 && (
                        <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm text-text text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm"
                        >
                            <Star className="w-3 h-3 text-primary fill-primary" />
                            {cafe.average_rating.toFixed(1)}
                        </div>
                    )}

                    {/* City badge */}
                    {cafe.city_municipality && (
                        <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm text-text text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm"
                        >
                            <MapPinIcon className="w-3 h-3 text-primary" />
                            {cafe.city_municipality}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-1.5 flex-1 p-4"
                >
                    <span className="font-serif font-semibold text-lg text-text group-hover:text-primary transition-colors line-clamp-1"
                    >
                        {cafe.name}
                    </span>
                    <span className="text-text/60 text-sm line-clamp-2 leading-relaxed"
                    >
                        {cafe.address_display}
                    </span>
                    <div className="flex-1" />
                    {cafe.slug && (
                        <div className="flex flex-row justify-end items-center gap-1.5 text-sm text-primary/80 group-hover:text-primary font-medium transition-colors pt-2"
                        >
                            <span>View cafe</span>
                            <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                    )}
                </div>
            </Link>
        </motion.div>
    )
}

export default function BlogCafeHighlights({ cafes }: BlogCafeHighlightsProps) {
    if (!cafes || cafes.length === 0) return null

    return (
        <section className="mb-12">
            <h2 className="text-xl font-bold font-serif text-text mb-4">
                {cafes.length === 1 ? "Featured Cafe" : "Featured Cafes"}
            </h2>
            <div className={`grid gap-4 ${cafes.length === 1 ? "grid-cols-1 max-w-md" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
                {cafes.map((cafe, idx) => (
                    <CafeHighlightCard key={cafe.id} cafe={cafe} idx={idx} />
                ))}
            </div>
        </section>
    )
}
