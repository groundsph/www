"use client"

import { useState, useCallback } from "react"
import Cropper, { Area } from "react-easy-crop"
import { Loader2 } from "lucide-react"

interface ImageCropperProps {
    open: boolean
    image: string | File | null
    aspect?: number
    onComplete: (croppedImage: Blob) => void
    onCancel: () => void
}

export default function ImageCropper({
    open,
    image,
    aspect = 16 / 9,
    onComplete,
    onCancel,
}: ImageCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
        null
    )
    const [processing, setProcessing] = useState(false)

    // Convert file to URL if needed
    const imageUrl =
        image instanceof File ? URL.createObjectURL(image) : image || ""

    const onCropComplete = useCallback(
        (_croppedArea: Area, croppedAreaPixels: Area) => {
            setCroppedAreaPixels(croppedAreaPixels)
        },
        []
    )

    const createCroppedImage = async () => {
        if (!croppedAreaPixels || !imageUrl) return

        setProcessing(true)

        try {
            const image = await createImage(imageUrl)
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")

            if (!ctx) {
                throw new Error("No 2d context")
            }

            // Set canvas size to the final cropped size
            canvas.width = croppedAreaPixels.width
            canvas.height = croppedAreaPixels.height

            ctx.drawImage(
                image,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                croppedAreaPixels.width,
                croppedAreaPixels.height
            )

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        console.error("Canvas is empty")
                        return
                    }
                    onComplete(blob)
                    setProcessing(false)
                },
                "image/webp",
                0.9
            )
        } catch (e) {
            console.error(e)
            setProcessing(false)
        }
    }

    if (!open) return null

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-text/80 backdrop-blur-sm'>
            <div className='bg-background w-full max-w-xl rounded-2xl border border-text/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
                <div className='p-4 border-b border-text/10 flex justify-between items-center bg-background'>
                    <h2 className='text-lg font-semibold font-serif text-text'>
                        Adjust Image
                    </h2>
                    <button
                        onClick={onCancel}
                        className='p-1.5 hover:bg-text/10 rounded-full transition-colors text-text/60 hover:text-text cursor-pointer'
                    >
                        <svg
                            xmlns='http://www.w3.org/2000/svg'
                            width='20'
                            height='20'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        >
                            <path d='M18 6 6 18' />
                            <path d='m6 6 12 12' />
                        </svg>
                    </button>
                </div>

                <div className='relative w-full h-[400px] bg-text/90'>
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>

                <div className='p-4 space-y-4 bg-background'>
                    <div className='flex items-center gap-4'>
                        <span className='text-sm font-medium text-text/70 min-w-12'>
                            Zoom
                        </span>
                        <input
                            type='range'
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className='flex-1 h-2 bg-text/10 rounded-lg appearance-none cursor-pointer accent-primary'
                        />
                    </div>

                    <div className='flex justify-end gap-2 pt-2'>
                        <button
                            onClick={onCancel}
                            disabled={processing}
                            className='px-4 py-2.5 text-sm font-medium text-text/70 bg-background border border-text/20 rounded-xl hover:bg-text/5 hover:border-text/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors cursor-pointer'
                        >
                            Cancel
                        </button>
                        <button
                            onClick={createCroppedImage}
                            disabled={processing}
                            className='px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors flex items-center cursor-pointer'
                        >
                            {processing ? (
                                <>
                                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                                    Processing...
                                </>
                            ) : (
                                "Apply Crop"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener("load", () => resolve(image))
        image.addEventListener("error", (error) => reject(error))
        image.setAttribute("crossOrigin", "anonymous")
        image.src = url
    })
}
