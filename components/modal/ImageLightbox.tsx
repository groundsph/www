"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { useHaptics } from "@/hooks/useHaptics"

interface ImageLightboxProps {
    images: string[]
    initialIndex?: number
    isOpen: boolean
    onClose: () => void
    altPrefix?: string
}

export default function ImageLightbox({
    images,
    initialIndex = 0,
    isOpen,
    onClose,
    altPrefix = "Image",
}: ImageLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const { trigger: hapticTrigger } = useHaptics()

    const handleClose = useCallback(() => {
        hapticTrigger("soft")
        onClose()
    }, [hapticTrigger, onClose])

    const goToPrevious = useCallback(() => {
        hapticTrigger("selection")
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
    }, [hapticTrigger, images.length])

    const goToNext = useCallback(() => {
        hapticTrigger("selection")
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
    }, [hapticTrigger, images.length])

    const goToIndex = useCallback((idx: number) => {
        hapticTrigger("selection")
        setCurrentIndex(idx)
    }, [hapticTrigger])

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!isOpen) return

            switch (e.key) {
                case "Escape":
                    handleClose()
                    break
                case "ArrowLeft":
                    goToPrevious()
                    break
                case "ArrowRight":
                    goToNext()
                    break
            }
        },
        [isOpen, handleClose, goToPrevious, goToNext]
    )

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [handleKeyDown])

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    if (!isOpen || images.length === 0) return null

    return (
        <div
            className='fixed inset-0 z-50 flex items-center justify-center'
            role='dialog'
            aria-modal='true'
            aria-label='Image lightbox'
        >
            {/* Backdrop */}
            <div
                className='absolute inset-0 bg-black/90 backdrop-blur-sm'
                onClick={handleClose}
            />

            {/* Close button */}
            <button
                onClick={handleClose}
                className='absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer'
                aria-label='Close lightbox'
            >
                <X className='w-6 h-6' />
            </button>

            {/* Image counter */}
            {images.length > 1 && (
                <div className='absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm font-medium'>
                    {currentIndex + 1} / {images.length}
                </div>
            )}

            {/* Navigation arrows */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={goToPrevious}
                        className='absolute left-4 z-10 px-2 py-10 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-2 border-white/10 active:border-white/40 backdrop-blur-sm'
                        aria-label='Previous image'
                    >
                        <ChevronLeft className='w-6 h-6' />
                    </button>
                    <button
                        onClick={goToNext}
                        className='absolute right-4 z-10 px-2 py-10 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-2 border-white/10 active:border-white/40 backdrop-blur-sm'
                        aria-label='Next image'
                    >
                        <ChevronRight className='w-6 h-6' />
                    </button>
                </>
            )}

            {/* Image container */}
            <div className='relative w-full h-full flex items-center justify-center p-8 md:p-16'>
                <Image
                    src={images[currentIndex]}
                    alt={`${altPrefix} ${currentIndex + 1}`}
                    fill
                    className='object-contain'
                    sizes='100vw'
                    priority
                />
            </div>

            {/* Thumbnail strip for multiple images */}
            {images.length > 1 && (
                <div className='absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 p-2 rounded-xl bg-black/50 backdrop-blur-sm max-w-[90vw] overflow-x-auto'>
                    {images.map((image, idx) => (
                            <button
                                key={idx}
                                onClick={() => goToIndex(idx)}
                            className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 transition-all cursor-pointer ${
                                idx === currentIndex
                                    ? "ring-2 ring-white ring-offset-2 ring-offset-black/50"
                                    : "opacity-60 hover:opacity-100"
                            }`}
                            aria-label={`View image ${idx + 1}`}
                        >
                            <Image
                                src={image}
                                alt={`Thumbnail ${idx + 1}`}
                                fill
                                className='object-cover'
                                sizes='48px'
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
