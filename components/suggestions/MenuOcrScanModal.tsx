"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { X as XIcon, Camera, Loader2, Check, Trash2, ScanLine, AlertCircle } from "lucide-react"
import imageCompression from "browser-image-compression"
import { scanMenuImage, saveOcrMenuItems } from "@/app/api/actions/menu-ocr"
import { MENU_CATEGORIES } from "@/utils/types/owner"
import type { OcrMenuItem } from "@/utils/ai/menu-ocr"
import Link from "next/link"

interface MenuOcrScanModalProps {
    isOpen: boolean
    onClose: () => void
    cafeId: string
    cafeName: string
    cafeSlug: string
}

type Step = "upload" | "scanning" | "review" | "saving" | "done"

interface EditableItem {
    id: number
    name: string
    category: string
    price: number
}

export default function MenuOcrScanModal({
    isOpen,
    onClose,
    cafeId,
    cafeName,
    cafeSlug,
}: MenuOcrScanModalProps) {
    const [step, setStep] = useState<Step>("upload")
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [extractedItems, setExtractedItems] = useState<EditableItem[]>([])
    const [duplicates, setDuplicates] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [savedCount, setSavedCount] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const shouldResetRef = useRef(false)

    const resetState = useCallback(() => {
        setStep("upload")
        setImagePreview(null)
        setExtractedItems([])
        setDuplicates([])
        setError(null)
        setSavedCount(0)
    }, [])

    useEffect(() => {
        if (!isOpen && shouldResetRef.current) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStep("upload")
            setImagePreview(null)
            setExtractedItems([])
            setDuplicates([])
            setError(null)
            setSavedCount(0)
            shouldResetRef.current = false
        }
        if (isOpen) {
            shouldResetRef.current = true
        }
    }, [isOpen])

    const handleClose = useCallback(() => {
        resetState()
        onClose()
    }, [resetState, onClose])

    const handleImageSelect = async (file: File) => {
        try {
            const compressed = await imageCompression(file, {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            })

            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => {
                    const result = reader.result as string
                    const base64Data = result.split(",")[1]
                    if (base64Data) {
                        resolve(base64Data)
                    } else {
                        reject(new Error("Failed to convert to base64"))
                    }
                }
                reader.onerror = reject
                reader.readAsDataURL(compressed)
            })

            setImagePreview(URL.createObjectURL(compressed))
            setStep("scanning")
            setError(null)

            const result = await scanMenuImage(cafeId, base64)

            if (result.success) {
                const editableItems: EditableItem[] = (result.deduplicated ?? []).map(
                    (item, index) => ({
                        id: index,
                        name: item.name,
                        category: item.category,
                        price: typeof item.price === "string" ? parseFloat(item.price) : item.price,
                    })
                )
                setExtractedItems(editableItems)
                setDuplicates(result.duplicates ?? [])
                setStep("review")
            } else {
                setError(result.error ?? "Failed to scan menu")
                setStep("upload")
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to process image")
            setStep("upload")
        }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleImageSelect(file)
        }
    }

    const handleRemoveItem = (id: number) => {
        setExtractedItems((prev) => prev.filter((item) => item.id !== id))
    }

    const handleUpdateItem = (id: number, field: keyof EditableItem, value: string | number) => {
        setExtractedItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        )
    }

    const handleSave = async () => {
        setStep("saving")

        const itemsToSave: OcrMenuItem[] = extractedItems.map((item) => ({
            name: item.name,
            category: item.category,
            price: item.price,
        }))

        const result = await saveOcrMenuItems(cafeId, itemsToSave)

        if (result.success) {
            setSavedCount(result.saved ?? extractedItems.length)
            setStep("done")
        } else {
            setError(result.error ?? "Failed to save menu items")
            setStep("review")
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className='fixed inset-0 bg-black/40 backdrop-blur-sm z-50'
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className='fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl sm:w-full bg-background rounded-xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden'
                    >
                        {/* Header */}
                        <div className='flex items-center justify-between p-4 border-b border-text/10'>
                            <div className='flex items-center gap-2'>
                                <ScanLine className='w-5 h-5 text-primary' />
                                <span className='text-xs font-medium tracking-wide uppercase text-text/50'>
                                    Scan Menu
                                </span>
                            </div>
                            <div className='flex items-center gap-3'>
                                <span className='text-sm font-medium text-text'>
                                    {cafeName}
                                </span>
                                <button
                                    onClick={handleClose}
                                    className='p-2 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text cursor-pointer'
                                >
                                    <XIcon className='w-5 h-5' />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className='flex-1 overflow-y-auto p-4'>
                            {step === "upload" && (
                                <div className='flex flex-col items-center justify-center min-h-[300px]'>
                                    {error && (
                                        <div className='mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center gap-2 w-full'>
                                            <AlertCircle className='w-4 h-4 shrink-0' />
                                            {error}
                                        </div>
                                    )}
                                    <label className='flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-text/20 rounded-xl cursor-pointer hover:border-text/40 transition-colors'>
                                        <Camera className='w-12 h-12 text-text/30 mb-3' />
                                        <span className='text-text/60 text-sm'>
                                            Tap to take a photo or select an image
                                        </span>
                                        <input
                                            ref={fileInputRef}
                                            type='file'
                                            accept='image/*'
                                            capture='environment'
                                            onChange={handleFileInputChange}
                                            className='hidden'
                                        />
                                    </label>
                                </div>
                            )}

                            {step === "scanning" && (
                                <div className='flex flex-col items-center justify-center min-h-[300px] gap-4'>
                                    {imagePreview && (
                                        <div className='relative w-full h-48 rounded-xl overflow-hidden bg-text/5'>
                                            <Image
                                                src={imagePreview}
                                                alt='Menu preview'
                                                fill
                                                className='object-contain'
                                            />
                                        </div>
                                    )}
                                    <div className='flex items-center gap-3 text-text/60'>
                                        <Loader2 className='w-5 h-5 animate-spin' />
                                        <span>Scanning menu...</span>
                                    </div>
                                </div>
                            )}

                            {step === "review" && (
                                <div className='space-y-4'>
                                    {duplicates.length > 0 && (
                                        <div className='p-3 bg-amber-10 border border-amber-20 rounded-lg'>
                                            <p className='text-sm font-medium text-amber-90 mb-1'>
                                                {duplicates.length} duplicate(s) skipped
                                            </p>
                                            <p className='text-xs text-amber-80/70'>
                                                {duplicates.join(", ")}
                                            </p>
                                        </div>
                                    )}

                                    {extractedItems.length === 0 ? (
                                        <div className='flex flex-col items-center justify-center py-12 gap-3 text-center'>
                                            <AlertCircle className='w-10 h-10 text-text/30' />
                                            <p className='text-text/60'>
                                                No new items found. Try a different photo.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className='space-y-2'>
                                            {extractedItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className='flex items-center gap-2 p-2 bg-text/5 rounded-lg'
                                                >
                                                    <div className='flex-1 grid grid-cols-3 gap-2'>
                                                        <input
                                                            type='text'
                                                            value={item.name}
                                                            onChange={(e) =>
                                                                handleUpdateItem(
                                                                    item.id,
                                                                    "name",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className='px-2 py-1.5 bg-background border border-text/10 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary'
                                                        />
                                                        <select
                                                            value={item.category}
                                                            onChange={(e) =>
                                                                handleUpdateItem(
                                                                    item.id,
                                                                    "category",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className='px-2 py-1.5 bg-background border border-text/10 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary'
                                                        >
                                                            {MENU_CATEGORIES.map((cat) => (
                                                                <option
                                                                    key={cat}
                                                                    value={cat}
                                                                >
                                                                    {cat}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type='number'
                                                            step='0.01'
                                                            min='0'
                                                            value={item.price}
                                                            onChange={(e) =>
                                                                handleUpdateItem(
                                                                    item.id,
                                                                    "price",
                                                                    parseFloat(e.target.value) || 0
                                                                )
                                                            }
                                                            className='px-2 py-1.5 bg-background border border-text/10 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary'
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className='p-1.5 hover:bg-destructive/10 rounded transition-colors text-destructive/60 hover:text-destructive cursor-pointer'
                                                    >
                                                        <Trash2 className='w-4 h-4' />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === "saving" && (
                                <div className='flex flex-col items-center justify-center min-h-[300px] gap-4'>
                                    <Loader2 className='w-8 h-8 animate-spin text-primary' />
                                    <span className='text-text/60'>Saving menu items...</span>
                                </div>
                            )}

                            {step === "done" && (
                                <div className='flex flex-col items-center justify-center min-h-[300px] gap-4'>
                                    <div className='w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center'>
                                        <Check className='w-8 h-8 text-primary' />
                                    </div>
                                    <div className='text-center'>
                                        <h3 className='text-lg font-semibold text-text'>
                                            {savedCount} item(s) added!
                                        </h3>
                                    </div>
                                    <Link
                                        href={`/cafes/${cafeSlug}/menu`}
                                        className='text-sm text-primary hover:underline'
                                        onClick={handleClose}
                                    >
                                        View menu
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {(step === "upload" || step === "review") && (
                            <div className='p-4 border-t border-text/10 flex gap-3'>
                                <button
                                    type='button'
                                    onClick={handleClose}
                                    className='flex-1 px-4 py-2.5 bg-text/10 hover:bg-text/20 text-text rounded-lg font-medium transition-colors cursor-pointer'
                                >
                                    Cancel
                                </button>
                                {step === "review" && (
                                    <button
                                        type='button'
                                        onClick={handleSave}
                                        disabled={extractedItems.length === 0}
                                        className='flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer'
                                    >
                                        Save
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
