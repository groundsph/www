"use client"

import { MapPin } from "lucide-react"
import { CafeWithRatings } from "@/utils/types/extra"
import CrawlRouteMap from "@/components/map/CrawlRouteMap"
import { buildCrawlMapPoints } from "@/utils/map/crawl-map-points"

interface MapBlockViewProps {
    cafes: CafeWithRatings[]
    title?: string
    caption?: string
}

/** Inline map of the selected cafes, reusing the crawl route map renderer. */
export default function MapBlockView({ cafes, title, caption }: MapBlockViewProps) {
    const points = buildCrawlMapPoints(
        cafes.map((cafe, index) => ({
            name: cafe.name,
            slug: cafe.slug,
            thumbnail: cafe.thumbnail ?? null,
            lat: cafe.lat,
            lng: cafe.lng,
            sortOrder: index,
        }))
    )

    if (points.length === 0) {
        return (
            <div className="my-6 rounded-2xl border border-dashed border-text/20 bg-text/5 p-6 text-center text-sm text-text/50">
                <MapPin className="mx-auto mb-2 w-5 h-5 opacity-50" />
                None of the selected cafes have map coordinates.
            </div>
        )
    }

    return (
        <section className="my-8">
            {(title || caption) && (
                <div className="mb-3">
                    {title && (
                        <h3 className="flex items-center gap-2 font-medium text-text">
                            <MapPin className="w-4 h-4 text-primary" />
                            {title}
                        </h3>
                    )}
                    {caption && <p className="mt-1 text-sm text-text/60">{caption}</p>}
                </div>
            )}
            <div className="h-[320px] md:h-[420px] overflow-hidden rounded-2xl border border-secondary/20">
                <CrawlRouteMap points={points} />
            </div>
        </section>
    )
}
