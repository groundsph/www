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

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.05, duration: 0.2 },
    }),
    exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
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
    const [scanElapsed, setScanElapsed] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const shouldResetRef = useRef(false)

    const resetState = useCallback(() => {
        setStep("upload")
        setImagePreview(null)
        setExtractedItems([])
        setDuplicates([])
        setError(null)
        setSavedCount(0)
        setScanElapsed(0)
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
             
            setScanElapsed(0)
            shouldResetRef.current = false
        }
        if (isOpen) {
            shouldResetRef.current = true
        }
    }, [isOpen])

    // Elapsed time counter during scanning
    useEffect(() => {
        if (step === "scanning") {
            const startTime = Date.now()
            const interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000)
                setScanElapsed(elapsed)
            }, 1000)
            return () => clearInterval(interval)
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setScanElapsed(0)
        }
    }, [step])

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
                        category: MENU_CATEGORIES.includes(item.category as typeof MENU_CATEGORIES[number])
                            ? item.category
                            : "Other",
                        price: typeof item.price === "string" ? parseFloat(item.price) : item.price,
                    })
                )
                setExtractedItems(editableItems)
                setDuplicates(result.duplicates ?? [])
                // Small delay before showing review for smooth transition
                setTimeout(() => setStep("review"), 300)
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
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl sm:w-full bg-background rounded-2xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-text/10">
                            <motion.div
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="flex items-center gap-2"
                            >
                                <motion.div
                                    animate={{ rotate: step === "scanning" ? 360 : 0 }}
                                    transition={{ duration: 2, repeat: step === "scanning" ? Infinity : 0, ease: "linear" }}
                                >
                                    <ScanLine className="w-5 h-5 text-primary" />
                                </motion.div>
                                <span className="text-xs font-medium tracking-wide uppercase text-text/50">
                                    Scan Menu
                                </span>
                            </motion.div>
                            <div className="flex items-center gap-3">
                                <motion.span
                                    initial={{ x: 10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    className="text-sm font-medium text-text hidden sm:block"
                                >
                                    {cafeName}
                                </motion.span>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleClose}
                                    className="p-2 hover:bg-text/10 rounded-xl transition-colors text-text/40 hover:text-text cursor-pointer"
                                >
                                    <XIcon className="w-5 h-5" />
                                </motion.button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {step === "upload" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center min-h-[300px]"
                                >
                                    <AnimatePresence mode="wait">
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, height: 0 }}
                                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                                exit={{ opacity: 0, y: -10, height: 0 }}
                                                className="mb-4 w-full"
                                            >
                                                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm flex items-center gap-2">
                                                    <motion.div
                                                        animate={{ x: [0, -5, 5, -5, 0] }}
                                                        transition={{ duration: 0.4 }}
                                                    >
                                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                                    </motion.div>
                                                    {error}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <motion.label
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="flex flex-col items-center justify-center w-full max-w-sm h-64 border-2 border-dashed border-text/20 rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
                                    >
                                        <motion.div
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            className="mb-3"
                                        >
                                            <Camera className="w-14 h-14 text-text/30 group-hover:text-primary/60 transition-colors" />
                                        </motion.div>
                                        <span className="text-text/60 text-sm text-center px-4 group-hover:text-text/80 transition-colors">
                                            Tap to take a photo or select an image
                                        </span>
                                        <span className="text-text/40 text-xs mt-2">
                                            JPG, PNG up to 10MB
                                        </span>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleFileInputChange}
                                            className="hidden"
                                        />
                                    </motion.label>
                                </motion.div>
                            )}

                            {step === "scanning" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center min-h-[300px] gap-6"
                                >
                                    <AnimatePresence mode="wait">
                                        {imagePreview && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden shadow-lg"
                                            >
                                                <Image
                                                    src={imagePreview}
                                                    alt="Menu preview"
                                                    fill
                                                    className="object-cover"
                                                />
                                                <motion.div
                                                    className="absolute inset-0 bg-primary/10"
                                                    animate={{ opacity: [0.1, 0.2, 0.1] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="w-full max-w-sm space-y-3">
                                        <div className="flex items-center justify-center gap-3">
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                            >
                                                <Loader2 className="w-5 h-5 text-primary" />
                                            </motion.div>
                                            <span className="text-text/70 font-medium animate-pulse">
                                                Scanning menu...
                                            </span>
                                        </div>

                                        <div className="w-full max-w-sm space-y-2">
                                            <div className="flex items-center justify-between text-xs text-text/50">
                                                <span>Elapsed time</span>
                                                <motion.span
                                                    animate={{
                                                        color: scanElapsed > 120 
                                                            ? ["#ef4444", "#f97316", "#ef4444"] 
                                                            : "#6b7280"
                                                    }}
                                                    transition={{ duration: 1, repeat: scanElapsed > 120 ? Infinity : 0 }}
                                                    className="font-mono font-medium"
                                                >
                                                    {Math.floor(scanElapsed / 60)}:{String(scanElapsed % 60).padStart(2, "0")}
                                                </motion.span>
                                            </div>
                                            <div className="h-1.5 bg-text/10 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    initial={{ width: "0%" }}
                                                    animate={{ 
                                                        width: `${Math.min((scanElapsed / 180) * 100, 100)}%`,
                                                        backgroundColor: scanElapsed > 120 
                                                            ? ["#ef4444", "#f97316", "#ef4444"] 
                                                            : "#3b82f6"
                                                    }}
                                                    transition={{ width: { duration: 1 }, backgroundColor: { duration: 1, repeat: scanElapsed > 120 ? Infinity : 0 } }}
                                                />
                                            </div>
                                            {scanElapsed > 120 && (
                                                <motion.p 
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    className="text-xs text-amber-500 text-center"
                                                >
                                                    Taking longer than expected... if it fails, try a smaller image
                                                </motion.p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === "review" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-4"
                                >
                                    <AnimatePresence mode="wait">
                                        {duplicates.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
                                                    <p className="text-sm font-medium text-amber-700 flex items-center gap-2">
                                                        <motion.div
                                                            animate={{ rotate: [0, -10, 10, -10, 0] }}
                                                            transition={{ duration: 0.4 }}
                                                        >
                                                            <AlertCircle className="w-4 h-4" />
                                                        </motion.div>
                                                        {duplicates.length} duplicate{duplicates.length === 1 ? "" : "s"} skipped
                                                    </p>
                                                    <p className="text-xs text-amber-600/80 mt-1">
                                                        {duplicates.slice(0, 5).join(", ")}
                                                        {duplicates.length > 5 && ` and ${duplicates.length - 5} more`}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {extractedItems.length === 0 ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex flex-col items-center justify-center py-12 gap-3 text-center"
                                        >
                                            <AlertCircle className="w-12 h-12 text-text/30" />
                                            <p className="text-text/60 font-medium">
                                                No new items found
                                            </p>
                                            <p className="text-text/40 text-sm">
                                                Try a different photo with clearer text
                                            </p>
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setStep("upload")}
                                                className="mt-2 px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                                            >
                                                Try again
                                            </motion.button>
                                        </motion.div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-text/70">
                                                    Review {extractedItems.length} extracted item{extractedItems.length === 1 ? "" : "s"}
                                                </p>
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium"
                                                >
                                                    {extractedItems.length} items
                                                </motion.span>
                                            </div>

                                            <motion.div
                                                initial="hidden"
                                                animate="visible"
                                                className="space-y-2"
                                            >
                                                {extractedItems.map((item, idx) => (
                                                    <motion.div
                                                        key={item.id}
                                                        custom={idx}
                                                        variants={itemVariants}
                                                        initial="hidden"
                                                        animate="visible"
                                                        exit="exit"
                                                        layout
                                                        className="group flex items-center gap-2 p-3 bg-text/5 hover:bg-text/10 rounded-xl transition-colors"
                                                    >
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -5 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary"
                                                        >
                                                            {idx + 1}
                                                        </motion.div>
                                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                            <motion.input
                                                                whileFocus={{ scale: 1.02 }}
                                                                type="text"
                                                                value={item.name}
                                                                onChange={(e) =>
                                                                    handleUpdateItem(item.id, "name", e.target.value)
                                                                }
                                                                className="px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                                                placeholder="Item name"
                                                            />
                                                            <select
                                                                value={item.category}
                                                                onChange={(e) =>
                                                                    handleUpdateItem(item.id, "category", e.target.value)
                                                                }
                                                                className="px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer"
                                                            >
                                                                {MENU_CATEGORIES.map((cat) => (
                                                                    <option key={cat} value={cat}>
                                                                        {cat}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text/40 text-sm">₱</span>
                                                                <motion.input
                                                                    whileFocus={{ scale: 1.02 }}
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={item.price}
                                                                    onChange={(e) =>
                                                                        handleUpdateItem(
                                                                            item.id,
                                                                            "price",
                                                                            parseFloat(e.target.value) || 0
                                                                        )
                                                                    }
                                                                    className="w-full pl-7 pr-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                        <motion.button
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={() => handleRemoveItem(item.id)}
                                                            className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-text/30 hover:text-destructive cursor-pointer opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </motion.button>
                                                    </motion.div>
                                                ))}
                                            </motion.div>
                                        </>
                                    )}
                                </motion.div>
                            )}

                            {step === "saving" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center min-h-[300px] gap-6"
                                >
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    >
                                        <Loader2 className="w-10 h-10 text-primary" />
                                    </motion.div>
                                    <div className="text-center">
                                        <motion.p
                                            animate={{ opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="text-text/70 font-medium"
                                        >
                                            Saving menu items...
                                        </motion.p>
                                        <p className="text-text/40 text-sm mt-1">
                                            Adding to {cafeName}
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {step === "done" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center min-h-[300px] gap-6"
                                >
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                                        className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
                                    >
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", damping: 10, stiffness: 300, delay: 0.3 }}
                                        >
                                            <Check className="w-10 h-10 text-primary" />
                                        </motion.div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4 }}
                                        className="text-center"
                                    >
                                        <motion.h3
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.5 }}
                                            className="text-xl font-semibold text-text"
                                        >
                                            <motion.span
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.6 }}
                                            >
                                                {savedCount} item
                                            </motion.span>
                                            {savedCount !== 1 ? "s" : ""}{" "}
                                            <motion.span
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.7 }}
                                            >
                                                added!
                                            </motion.span>
                                        </motion.h3>
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.8 }}
                                            className="text-text/50 text-sm mt-2"
                                        >
                                            {cafeName} menu has been updated
                                        </motion.p>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.9 }}
                                        className="flex gap-3"
                                    >
                                        <Link
                                            href={`/cafes/${cafeSlug}/menu`}
                                            onClick={handleClose}
                                            className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-xl transition-colors"
                                        >
                                            View menu
                                        </Link>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleClose}
                                            className="px-4 py-2 text-sm font-medium bg-primary text-white hover:bg-primary/90 rounded-xl transition-colors cursor-pointer"
                                        >
                                            Done
                                        </motion.button>
                                    </motion.div>
                                </motion.div>
                            )}
                        </div>

                        {/* Footer */}
                        <AnimatePresence>
                            {(step === "upload" || step === "review") && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="p-4 border-t border-text/10 flex gap-3"
                                >
                                    <motion.button
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        type="button"
                                        onClick={handleClose}
                                        className="flex-1 px-4 py-3 bg-text/10 hover:bg-text/20 text-text rounded-xl font-medium transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </motion.button>
                                    {step === "review" && (
                                        <motion.button
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.97 }}
                                            type="button"
                                            onClick={handleSave}
                                            disabled={extractedItems.length === 0}
                                            className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20"
                                        >
                                            <Check className="w-4 h-4" />
                                            Save {extractedItems.length > 0 && `(${extractedItems.length})`}
                                        </motion.button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
