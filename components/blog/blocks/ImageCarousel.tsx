"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Images, ZoomIn } from "lucide-react"
import ImageLightbox, { type LightboxImage } from "./ImageLightbox"

interface ImageCarouselProps {
    images: LightboxImage[]
    title?: string
}

/** Horizontally scrollable image carousel with a lightbox. */
export default function ImageCarousel({ images, title }: ImageCarouselProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
    const [activeSlide, setActiveSlide] = useState(0)

    if (images.length === 0) return null

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
        const step = slide.offsetWidth + 16
        setActiveSlide(Math.round(track.scrollLeft / step))
    }

    const single = images.length === 1

    return (
        <section className="my-8">
            <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="flex items-center gap-2 font-medium text-text">
                    <Images className="w-4 h-4 text-primary" />
                    {title || (single ? "Image" : "Gallery")}
                </h3>
                {!single && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text/40">
                            {activeSlide + 1}/{images.length}
                        </span>
                        <button
                            type="button"
                            onClick={() => scrollBySlide(-1)}
                            className="p-1.5 rounded-lg border border-text/10 hover:bg-text/5 transition-colors"
                            aria-label="Previous images"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollBySlide(1)}
                            className="p-1.5 rounded-lg border border-text/10 hover:bg-text/5 transition-colors"
                            aria-label="Next images"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <div
                ref={trackRef}
                onScroll={handleScroll}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 custom-scrollbar"
            >
                {images.map((image, index) => (
                    <button
                        key={`${image.url}-${index}`}
                        data-slide
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className="group relative shrink-0 snap-start overflow-hidden rounded-2xl bg-text/5 cursor-zoom-in w-[85%] sm:w-[60%] md:w-[48%]"
                    >
                        <div className="relative aspect-4/3 w-full">
                            <Image
                                src={image.url}
                                alt={image.caption || `Image ${index + 1}`}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="(max-width: 768px) 85vw, 48vw"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                                <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                            </span>
                        </div>
                        {image.caption && (
                            <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 text-left text-sm text-white">
                                {image.caption}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <ImageLightbox
                images={images}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onIndexChange={setLightboxIndex}
            />
        </section>
    )
}
