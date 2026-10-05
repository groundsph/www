"use client"

import { useEffect } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

export interface LightboxImage {
    url: string
    caption?: string
}

interface ImageLightboxProps {
    images: LightboxImage[]
    index: number | null
    onClose: () => void
    onIndexChange: (index: number) => void
}

/**
 * Fullscreen image viewer with keyboard + button navigation.
 * Shared by the single-image and carousel block renderers.
 */
export default function ImageLightbox({
    images,
    index,
    onClose,
    onIndexChange,
}: ImageLightboxProps) {
    const isOpen = index !== null

    useEffect(() => {
        if (!isOpen) return
        const handler = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose()
            if (event.key === "ArrowLeft") {
                onIndexChange(index === 0 ? images.length - 1 : index - 1)
            }
            if (event.key === "ArrowRight") {
                onIndexChange(index === images.length - 1 ? 0 : index + 1)
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [isOpen, index, images.length, onClose, onIndexChange])

    if (index === null || !images[index]) return null

    const goToPrevious = () =>
        onIndexChange(index === 0 ? images.length - 1 : index - 1)
    const goToNext = () =>
        onIndexChange(index === images.length - 1 ? 0 : index + 1)

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-100 bg-black/95 flex items-center justify-center"
                onClick={onClose}
                role="dialog"
                aria-modal="true"
                aria-label="Image viewer"
            >
                <button
                    className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors z-10"
                    onClick={onClose}
                    aria-label="Close image viewer"
                >
                    <X className="w-8 h-8" />
                </button>

                {images.length > 1 && (
                    <>
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white transition-colors z-10"
                            onClick={(e) => {
                                e.stopPropagation()
                                goToPrevious()
                            }}
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-10 h-10" />
                        </button>
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white transition-colors z-10"
                            onClick={(e) => {
                                e.stopPropagation()
                                goToNext()
                            }}
                            aria-label="Next image"
                        >
                            <ChevronRight className="w-10 h-10" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
                            {index + 1} / {images.length}
                        </div>
                    </>
                )}

                <div
                    className="relative w-[90vw] h-[80vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Image
                        src={images[index].url}
                        alt={images[index].caption || `Image ${index + 1}`}
                        fill
                        className="object-contain"
                        sizes="90vw"
                        priority
                    />
                </div>

                {images[index].caption && (
                    <p className="absolute bottom-12 left-1/2 -translate-x-1/2 max-w-3xl text-center text-white/80 text-sm px-4">
                        {images[index].caption}
                    </p>
                )}
            </motion.div>
        </AnimatePresence>
    )
}
