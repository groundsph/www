"use client"

import { useState } from "react"
import { ZoomIn } from "lucide-react"
import ImageLightbox from "./ImageLightbox"

interface ImageBlockViewProps {
    url: string
    alt?: string
    caption?: string
}

/** Single image block with click-to-zoom. */
export default function ImageBlockView({ url, alt, caption }: ImageBlockViewProps) {
    const [open, setOpen] = useState(false)

    return (
        <figure className="my-6">
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="relative block w-full overflow-hidden rounded-2xl group cursor-zoom-in"
                aria-label="Open image"
            >
                {/* eslint-disable-next-line @next/next/no-img-element -- block images have unknown aspect ratios */}
                <img
                    src={url}
                    alt={alt || caption || ""}
                    loading="lazy"
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/15 transition-colors">
                    <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </span>
            </button>
            {caption && (
                <figcaption className="mt-2 text-center text-sm text-text/60 italic">
                    {caption}
                </figcaption>
            )}
            <ImageLightbox
                images={[{ url, caption }]}
                index={open ? 0 : null}
                onClose={() => setOpen(false)}
                onIndexChange={() => {}}
            />
        </figure>
    )
}
