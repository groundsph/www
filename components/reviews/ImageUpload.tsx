"use client"

import { UploadCloud, X } from "lucide-react"
import Image from "next/image"
import { useCallback, useState, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { cn } from "@/utils/cn"

interface ImageUploadProps {
    value: (string | File)[]
    onChange: (files: (string | File)[]) => void
    disabled?: boolean
    maxImages?: number // 0 or undefined = unlimited
    progress?: Record<number, number> // Map of index -> progress (0-100)
}

export default function ImageUpload({
    value = [], // Default to empty array to be safe
    onChange,
    disabled,
    maxImages = 3, // Default to 3 for backwards compatibility, 0 = unlimited
    progress = {},
}: ImageUploadProps) {
    const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map())

    // Clean up object URLs when component unmounts or files change
    useEffect(() => {
        const urls = previewUrls
        return () => {
            urls.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [previewUrls])

    const getPreviewUrl = (item: string | File) => {
        if (typeof item === "string") return item

        if (!previewUrls.has(item)) {
            const url = URL.createObjectURL(item)
            setPreviewUrls((prev) => {
                const newMap = new Map(prev)
                newMap.set(item, url)
                return newMap
            })
            return url
        }
        return previewUrls.get(item)!
    }

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return

            // If maxImages is 0 or not set, allow unlimited
            if (maxImages === 0) {
                onChange([...value, ...acceptedFiles])
            } else {
                const remainingSlots = maxImages - value.length
                const filesToAdd = acceptedFiles.slice(0, remainingSlots)
                if (filesToAdd.length > 0) {
                    onChange([...value, ...filesToAdd])
                }
            }
        },
        [onChange, value, maxImages]
    )

    const removeImage = (itemToRemove: string | File) => {
        onChange(value.filter((item) => item !== itemToRemove))

        // Cleanup preview URL if it's a file
        if (itemToRemove instanceof File && previewUrls.has(itemToRemove)) {
            URL.revokeObjectURL(previewUrls.get(itemToRemove)!)
            setPreviewUrls((prev) => {
                const newMap = new Map(prev)
                newMap.delete(itemToRemove)
                return newMap
            })
        }
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/jpeg": [],
            "image/png": [],
            "image/webp": [],
            "image/gif": [],
        },
        maxSize: 5 * 1024 * 1024, // 5MB
        disabled: disabled || (maxImages > 0 && value.length >= maxImages),
        multiple: true,
    })

    return (
        <div className='w-full'>
            <div className='flex flex-row gap-3 mb-4 overflow-x-auto pb-2 min-h-[100px]'>
                {value.map((item, idx) => (
                    <div
                        key={typeof item === "string" ? item : `file-${idx}`}
                        className='relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-text/10'
                    >
                        <Image
                            fill
                            src={getPreviewUrl(item)}
                            alt='Review image'
                            className='object-cover'
                        />
                        <button
                            type='button'
                            onClick={() => removeImage(item)}
                            className='absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors cursor-pointer z-10'
                            disabled={disabled}
                        >
                            <X className='w-3 h-3' />
                        </button>

                        {/* Progress Overlay */}
                        {progress[idx] !== undefined && progress[idx] < 100 && (
                            <div className='absolute inset-0 bg-black/40 flex items-center justify-center'>
                                <div className='w-16 h-1 bg-white/30 rounded-full overflow-hidden'>
                                    <div
                                        className='h-full bg-white transition-all duration-300'
                                        style={{ width: `${progress[idx]}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {(maxImages === 0 || value.length < maxImages) && (
                <div
                    {...getRootProps()}
                    className={cn(
                        "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors gap-2 text-center",
                        isDragActive
                            ? "border-primary bg-primary/5"
                            : "border-text/20 hover:border-text/40 hover:bg-text/5",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <input {...getInputProps()} />
                    <div className='p-3 bg-text/5 rounded-full inline-block'>
                        <UploadCloud className='w-6 h-6 text-text/60' />
                    </div>
                    <div className='flex flex-col gap-0.5'>
                        <p className='text-sm font-semibold text-text/80'>
                            Click to upload images
                        </p>
                        <p className='text-xs text-text/50'>
                            JPG, PNG, WebP up to 5MB
                            {maxImages > 0 ? ` (Max ${maxImages})` : ""}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
