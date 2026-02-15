"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { MapPin, ArrowRight, Coffee } from "lucide-react"
import CrawlRouteMap from "@/components/map/CrawlRouteMap"
import { buildCrawlMapPoints } from "@/utils/map/crawl-map-points"

interface BlogCrawlEmbedProps {
    crawl: {
        id: string
        slug: string
        title: string
        description: string | null
        coverImage: string | null
        itemCount: number
        items: {
            id: string
            cafeId: string
            name: string
            slug: string
            thumbnail: string | null
            cityMunicipality: string
            region: string
            lat: number | null
            lng: number | null
            averageRating: number | null
            totalReviews: number | null
            sortOrder: number
            note: string | null
        }[]
    }
}

export default function BlogCrawlEmbed({ crawl }: BlogCrawlEmbedProps) {
    if (!crawl || !crawl.items || crawl.items.length === 0) return null

    const mapPoints = buildCrawlMapPoints(
        crawl.items.map((item) => ({
            name: item.name,
            slug: item.slug,
            thumbnail: item.thumbnail,
            lat: item.lat,
            lng: item.lng,
            sortOrder: item.sortOrder,
        }))
    )

    return (
        <section className="mb-12">
            <div className="border border-secondary/20 rounded-2xl overflow-hidden bg-secondary/5"
            >
                {/* Header */}
                <div className="p-6 border-b border-secondary/20"
                >
                    <div className="flex items-start justify-between gap-4"
                    >
                        <div className="flex-1"
                        >
                            <div className="flex items-center gap-2 text-primary mb-2"
                            >
                                <MapPin className="w-4 h-4" />
                                <span className="text-sm font-medium">Cafe Crawl</span>
                            </div>
                            <h2 className="text-2xl font-bold font-serif text-text mb-2"
                            >
                                {crawl.title}
                            </h2>
                            {crawl.description && (
                                <p className="text-text/60 line-clamp-2">{crawl.description}</p>
                            )}
                        </div>
                        <Link
                            href={`/crawls/${crawl.slug}`}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                        >
                            View crawl
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Map */}
                {mapPoints.length > 0 && (
                    <div className="h-[300px] md:h-[400px]"
                    >
                        <CrawlRouteMap points={mapPoints} />
                    </div>
                )}

                {/* Cafe List Preview */}
                <div className="p-6 bg-background"
                >
                    <h3 className="text-sm font-medium text-text/60 mb-4"
                    >
                        {crawl.itemCount} {crawl.itemCount === 1 ? "stop" : "stops"} on this crawl
                    </h3>
                    <div className="flex flex-col gap-3"
                    >
                        {crawl.items.slice(0, 5).map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Link
                                    href={`/cafes/${item.slug}`}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/10 transition-colors group"
                                >
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm"
                                    >
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0"
                                    >
                                        <p className="font-medium text-text group-hover:text-primary transition-colors truncate"
                                        >
                                            {item.name}
                                        </p>
                                        <p className="text-sm text-text/50 truncate"
                                        >
                                            {item.cityMunicipality}, {item.region}
                                        </p>
                                    </div>
                                    <Coffee className="w-4 h-4 text-text opacity-30 group-hover:text-primary transition-colors" />
                                </Link>
                            </motion.div>
                        ))}
                        {crawl.items.length > 5 && (
                            <div className="text-center py-2"
                            >
                                <Link
                                    href={`/crawls/${crawl.slug}`}
                                    className="text-primary text-sm font-medium hover:underline"
                                >
                                    + {crawl.items.length - 5} more stops
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Mobile CTA */}
                    <div className="sm:hidden mt-6"
                    >
                        <Link
                            href={`/crawls/${crawl.slug}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                        >
                            View full crawl
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}
