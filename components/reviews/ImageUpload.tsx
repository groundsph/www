"use client"

import { UploadCloud, X, ChevronLeft, ChevronRight } from "lucide-react"

import { useCallback, useState, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { cn } from "@/utils/cn"
import { Reorder } from "motion/react"

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

    const moveImage = (index: number, direction: "left" | "right") => {
        if (
            (direction === "left" && index === 0) ||
            (direction === "right" && index === value.length - 1)
        ) {
            return
        }

        const newIndex = direction === "left" ? index - 1 : index + 1
        const newValue = [...value]
        const [movedItem] = newValue.splice(index, 1)
        newValue.splice(newIndex, 0, movedItem)
        onChange(newValue)
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
            <Reorder.Group
                axis='x'
                values={value}
                onReorder={onChange}
                className='flex flex-row gap-3 mb-4 overflow-x-auto pb-4 min-h-[100px] scrollbar-thin scrollbar-thumb-text/10 scrollbar-track-transparent'
            >
                {value.map((item, idx) => {
                    const previewUrl = getPreviewUrl(item)
                    // Use previewUrl as key for Files (stable per session), item string for URLs
                    const key = typeof item === "string" ? item : previewUrl

                    return (
                        <Reorder.Item
                            key={key}
                            value={item}
                            className='relative h-32 w-auto shrink-0 rounded-lg overflow-hidden border border-text/10 group cursor-grab active:cursor-grabbing bg-gray-50 flex items-center justify-center'
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewUrl}
                                alt='Review image'
                                className='h-full w-auto object-contain pointer-events-none max-w-none' // Prevent image drag interfering with item drag
                            />
                            <button
                                type='button'
                                onClick={() => removeImage(item)}
                                className='absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors cursor-pointer z-10'
                                disabled={disabled}
                                title='Remove image'
                            >
                                <X className='w-3 h-3' />
                            </button>

                            {!disabled && (
                                <div className='absolute bottom-1 left-1 right-1 flex justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-full px-1 py-0.5 backdrop-blur-sm'>
                                    <button
                                        type='button'
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            moveImage(idx, "left")
                                        }}
                                        className={cn(
                                            "p-1 text-white hover:text-white/80 transition-colors",
                                            idx === 0 &&
                                                "opacity-20 cursor-not-allowed"
                                        )}
                                        disabled={idx === 0}
                                        title='Move left'
                                    >
                                        <ChevronLeft className='w-3 h-3' />
                                    </button>
                                    <button
                                        type='button'
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            moveImage(idx, "right")
                                        }}
                                        className={cn(
                                            "p-1 text-white hover:text-white/80 transition-colors",
                                            idx === value.length - 1 &&
                                                "opacity-20 cursor-not-allowed"
                                        )}
                                        disabled={idx === value.length - 1}
                                        title='Move right'
                                    >
                                        <ChevronRight className='w-3 h-3' />
                                    </button>
                                </div>
                            )}

                            {/* Progress Overlay */}
                            {progress[idx] !== undefined &&
                                progress[idx] < 100 && (
                                    <div className='absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none'>
                                        <div className='w-16 h-1 bg-white/30 rounded-full overflow-hidden'>
                                            <div
                                                className='h-full bg-white transition-all duration-300'
                                                style={{
                                                    width: `${progress[idx]}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                        </Reorder.Item>
                    )
                })}
            </Reorder.Group>

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
                        <UploadCloud className='w-6 h-6 text-text opacity-60' />
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
