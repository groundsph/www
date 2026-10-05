"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ImageIcon, Images, Loader2, Plus, Trash2 } from "lucide-react"
import type { GalleryBlock, ImageBlock } from "@/utils/types/blog-blocks"
import { Field, SecondaryButton, TextInput } from "./BlockFields"
import { cn } from "@/utils/cn"

interface UploadProps {
    uploadImage: (file: File) => Promise<string | null>
}

function DropZone({
    onFiles,
    uploading,
    multiple,
    label,
    className,
}: {
    onFiles: (files: File[]) => void
    uploading: boolean
    multiple?: boolean
    label: string
    className?: string
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return
        onFiles(Array.from(files).filter((f) => f.type.startsWith("image/")))
    }

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                handleFiles(e.dataTransfer.files)
            }}
            className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-all",
                dragging
                    ? "border-primary bg-primary/10"
                    : "border-text/20 hover:border-primary/50 hover:bg-primary/5",
                className
            )}
            onClick={() => inputRef.current?.click()}
        >
            {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : (
                <ImageIcon className="w-6 h-6 text-text/40" />
            )}
            <span className="text-xs text-text/60">{label}</span>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple={multiple}
                className="hidden"
                onChange={(e) => {
                    handleFiles(e.target.files)
                    e.target.value = ""
                }}
            />
        </div>
    )
}

export function ImageBlockEditor({
    block,
    update,
    uploadImage,
}: UploadProps & { block: ImageBlock; update: (next: ImageBlock) => void }) {
    const [uploading, setUploading] = useState(false)

    const handleFiles = async (files: File[]) => {
        if (files.length === 0) return
        setUploading(true)
        try {
            const url = await uploadImage(files[0])
            if (url) update({ ...block, url })
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="space-y-3">
            {block.url ? (
                <div className="relative overflow-hidden rounded-xl border border-text/10 bg-text/5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- block images have unknown aspect ratios */}
                    <img
                        src={block.url}
                        alt={block.alt || block.caption || ""}
                        className="max-h-80 w-full object-contain"
                    />
                    <button
                        type="button"
                        onClick={() => update({ ...block, url: "" })}
                        className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-red-500 shadow-sm transition-colors hover:bg-white"
                        aria-label="Remove image"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            ) : (
                <DropZone
                    onFiles={handleFiles}
                    uploading={uploading}
                    label="Drop an image here or click to upload"
                />
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Alt text">
                    <TextInput
                        value={block.alt || ""}
                        onChange={(alt) => update({ ...block, alt })}
                        placeholder="Describe the image"
                    />
                </Field>
                <Field label="Caption">
                    <TextInput
                        value={block.caption || ""}
                        onChange={(caption) => update({ ...block, caption })}
                        placeholder="Optional caption"
                    />
                </Field>
            </div>
        </div>
    )
}

export function GalleryBlockEditor({
    block,
    update,
    uploadImage,
}: UploadProps & { block: GalleryBlock; update: (next: GalleryBlock) => void }) {
    const [uploading, setUploading] = useState(false)

    const handleFiles = async (files: File[]) => {
        if (files.length === 0) return
        setUploading(true)
        try {
            const urls: string[] = []
            for (const file of files) {
                const url = await uploadImage(file)
                if (url) urls.push(url)
            }
            if (urls.length > 0) {
                update({
                    ...block,
                    images: [...block.images, ...urls.map((url) => ({ url }))],
                })
            }
        } finally {
            setUploading(false)
        }
    }

    const setCaption = (index: number, caption: string) => {
        const images = block.images.map((image, i) =>
            i === index ? { ...image, caption } : image
        )
        update({ ...block, images })
    }

    const removeImage = (index: number) => {
        update({ ...block, images: block.images.filter((_, i) => i !== index) })
    }

    const moveImage = (index: number, direction: -1 | 1) => {
        const target = index + direction
        if (target < 0 || target >= block.images.length) return
        const images = [...block.images]
        ;[images[index], images[target]] = [images[target], images[index]]
        update({ ...block, images })
    }

    return (
        <div className="space-y-3">
            <Field label="Carousel title">
                <TextInput
                    value={block.title || ""}
                    onChange={(title) => update({ ...block, title })}
                    placeholder="Gallery"
                />
            </Field>

            {block.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {block.images.map((image, index) => (
                        <div
                            key={`${image.url}-${index}`}
                            className="group space-y-1 rounded-xl border border-text/10 p-2"
                        >
                            <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-text/5">
                                <Image
                                    src={image.url}
                                    alt={image.caption || `Image ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    sizes="200px"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-500 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                                    aria-label="Remove image"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                                <div className="absolute bottom-1 left-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={() => moveImage(index, -1)}
                                        className="rounded bg-white/90 px-1.5 text-xs shadow-sm"
                                        aria-label="Move image left"
                                    >
                                        ←
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveImage(index, 1)}
                                        className="rounded bg-white/90 px-1.5 text-xs shadow-sm"
                                        aria-label="Move image right"
                                    >
                                        →
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                value={image.caption || ""}
                                onChange={(e) => setCaption(index, e.target.value)}
                                placeholder="Caption"
                                className="w-full rounded-md border border-text/10 bg-background px-2 py-1 text-[11px] outline-none focus:border-primary"
                            />
                        </div>
                    ))}
                </div>
            )}

            <DropZone
                onFiles={handleFiles}
                uploading={uploading}
                multiple
                label="Drop images here or click to upload"
            />

            <div className="flex items-center justify-between text-xs text-text/40">
                <span className="inline-flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5" />
                    {block.images.length} image{block.images.length === 1 ? "" : "s"}
                </span>
                {block.images.length > 0 && (
                    <SecondaryButton onClick={() => update({ ...block, images: [] })}>
                        <Plus className="w-3 h-3 rotate-45" />
                        Clear all
                    </SecondaryButton>
                )}
            </div>
        </div>
    )
}
