"use client"

import { useState } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"

interface BlogImageGalleryProps {
    images: string[]
}

export default function BlogImageGallery({ images }: BlogImageGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

    if (!images || images.length === 0) return null

    const openLightbox = (index: number) => {
        setSelectedIndex(index)
    }

    const closeLightbox = () => {
        setSelectedIndex(null)
    }

    const goToPrevious = () => {
        setSelectedIndex((prev) => {
            if (prev === null) return null
            return prev === 0 ? images.length - 1 : prev - 1
        })
    }

    const goToNext = () => {
        setSelectedIndex((prev) => {
            if (prev === null) return null
            return prev === images.length - 1 ? 0 : prev + 1
        })
    }

    // Grid layout based on image count
    const getGridClasses = () => {
        switch (images.length) {
            case 1:
                return "grid-cols-1"
            case 2:
                return "grid-cols-2"
            case 3:
                return "grid-cols-2 md:grid-cols-3"
            default:
                return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        }
    }

    return (
        <>
            <section className="mb-12">
                <h2 className="text-xl font-bold font-serif text-text mb-4">Gallery</h2>
                <div className={`grid ${getGridClasses()} gap-4`}>
                    {images.map((image, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative aspect-4/3 rounded-xl overflow-hidden cursor-pointer group"
                            onClick={() => openLightbox(index)}
                        >
                            <Image
                                src={image}
                                alt={`Gallery image ${index + 1}`}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
                            </div>

                            {/* Show "+N more" overlay on the last visible image if there are more */}
                            {index === 5 && images.length > 6 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <span className="text-white font-serif text-2xl">
                                        +{images.length - 6} more
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Lightbox */}
            <AnimatePresence>
                {selectedIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                        onClick={closeLightbox}
                    >
                        {/* Close button */}
                        <button
                            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors z-10"
                            onClick={closeLightbox}
                        >
                            <X className="w-8 h-8" />
                        </button>

                        {/* Navigation */}
                        {images.length > 1 && (
                            <>
                                <button
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white transition-colors z-10"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        goToPrevious()
                                    }}
                                >
                                    <ChevronLeft className="w-10 h-10" />
                                </button>
                                <button
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white transition-colors z-10"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        goToNext()
                                    }}
                                >
                                    <ChevronRight className="w-10 h-10" />
                                </button>
                            </>
                        )}

                        {/* Counter */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
                            {selectedIndex + 1} / {images.length}
                        </div>

                        {/* Image */}
                        <motion.div
                            key={selectedIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-[90vw] h-[80vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image
                                src={images[selectedIndex]}
                                alt={`Gallery image ${selectedIndex + 1}`}
                                fill
                                className="object-contain"
                                sizes="90vw"
                                priority
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
