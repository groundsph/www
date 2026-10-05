"use client"

import { useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import { CafeWithRatings } from "@/utils/types/extra"
import { CafeHighlightCard } from "@/components/blog/BlogCafeHighlights"

interface CafeCarouselProps {
    cafes: CafeWithRatings[]
    title?: string
    /** Optional note describing why these cafes are featured. */
    note?: string
    /** Force the carousel layout even for a single cafe. */
    variant?: "auto" | "carousel"
}

/**
 * Renders one or more cafes as a scroll-snap carousel.
 * A single cafe (auto variant) renders as a centred spotlight card instead.
 */
export default function CafeCarousel({
    cafes,
    title,
    note,
    variant = "auto",
}: CafeCarouselProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    const [active, setActive] = useState(0)

    if (cafes.length === 0) return null

    const isCarousel = variant === "carousel" || cafes.length > 1

    const scrollBySlide = (direction: 1 | -1) => {
        const track = trackRef.current
        if (!track) return
        const slide = track.querySelector<HTMLElement>("[data-slide]")
        const amount = slide ? slide.offsetWidth + 16 : track.clientWidth * 0.8
        track.scrollBy({ left: direction * amount, behavior: "smooth" })
    }

    const handleScroll = () => {
        const track = trackRef.current
        if (!track) return
        const slide = track.querySelector<HTMLElement>("[data-slide]")
        if (!slide) return
        setActive(Math.round(track.scrollLeft / (slide.offsetWidth + 16)))
    }

    const heading =
        title || (cafes.length === 1 ? "Featured Cafe" : "Featured Cafes")

    return (
        <section className="my-8">
            <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold font-serif text-text">
                        <MapPin className="w-5 h-5 text-primary" />
                        {heading}
                    </h2>
                    {note && <p className="mt-1 text-sm text-text/60">{note}</p>}
                </div>
                {isCarousel && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text/40">
                            {active + 1}/{cafes.length}
                        </span>
                        <button
                            type="button"
                            onClick={() => scrollBySlide(-1)}
                            className="p-1.5 rounded-lg border border-text/10 hover:bg-text/5 transition-colors"
                            aria-label="Previous cafes"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollBySlide(1)}
                            className="p-1.5 rounded-lg border border-text/10 hover:bg-text/5 transition-colors"
                            aria-label="Next cafes"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {isCarousel ? (
                <div
                    ref={trackRef}
                    onScroll={handleScroll}
                    className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 custom-scrollbar"
                >
                    {cafes.map((cafe, idx) => (
                        <div
                            key={cafe.id}
                            data-slide
                            className="shrink-0 snap-start w-[80%] sm:w-[55%] md:w-[42%] lg:w-[32%]"
                        >
                            <AnimatePresence>
                                <CafeHighlightCard cafe={cafe} idx={idx} />
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="max-w-md">
                    <CafeHighlightCard cafe={cafes[0]} idx={0} />
                </div>
            )}

            {isCarousel && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 flex justify-center gap-1.5"
                >
                    {cafes.map((cafe, idx) => (
                        <span
                            key={cafe.id}
                            className={`h-1.5 rounded-full transition-all ${
                                idx === active ? "w-5 bg-primary" : "w-1.5 bg-text/20"
                            }`}
                        />
                    ))}
                </motion.div>
            )}
        </section>
    )
}
