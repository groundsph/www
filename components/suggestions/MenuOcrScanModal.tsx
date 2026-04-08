"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { X as XIcon, Camera, Loader2, Check, Trash2, ScanLine, AlertCircle, ChevronDown, Plus } from "lucide-react"
import imageCompression from "browser-image-compression"
import { saveOcrMenuItems } from "@/app/api/actions/menu-ocr"
import { streamOcrScan } from "@/utils/ocr-stream-client"
import { MENU_CATEGORIES } from "@/utils/types/owner"
import { cn } from "@/utils/cn"
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
    description: string
    isFood: boolean
    isHot: boolean
    isCold: boolean
    isVegan: boolean
    isVegetarian: boolean
    calories: string
    sizeOptions: { label: string; price: number }[]
    isExpanded: boolean
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

function CustomCheckbox({
    checked,
    onChange,
    label,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
}) {
    return (
        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-text/5 transition-colors">
            <div className={cn(
                "relative w-4 h-4 border-2 rounded flex items-center justify-center transition-all duration-200",
                checked ? "border-primary/30 bg-primary/5" : "border-text/10 bg-text/5"
            )}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only"
                />
                <svg
                    className={cn("w-2.5 h-2.5 transition-all duration-200", checked ? "opacity-100 scale-100" : "opacity-0 scale-75")}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </div>
            <span className={cn("text-xs transition-colors duration-200", checked ? "text-text" : "text-text/60")}>
                {label}
            </span>
        </label>
    )
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
    const [statusMessage, setStatusMessage] = useState("Preparing...")
    const [streamedContent, setStreamedContent] = useState("")
    const streamedContentRef = useRef("")
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
        setStatusMessage("Preparing...")
        setStreamedContent("")
        streamedContentRef.current = ""
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
             
            setStatusMessage("Preparing...")
             
            setStreamedContent("")
             
            streamedContentRef.current = ""
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
            setStreamedContent("")
            streamedContentRef.current = ""
            setStatusMessage("Uploading image...")

            await streamOcrScan(cafeId, base64, {
                onStatus: (message) => {
                    setStatusMessage(message)
                },
                onContent: (token) => {
                    streamedContentRef.current += token
                    setStreamedContent(streamedContentRef.current)
                },
                onComplete: (data) => {
                    const editableItems: EditableItem[] = (data.deduplicated ?? []).map(
                        (item, index) => ({
                            id: index,
                            name: item.name,
                            category: MENU_CATEGORIES.includes(item.category as typeof MENU_CATEGORIES[number])
                                ? item.category
                                : "Other",
                            price: typeof item.price === "string" ? parseFloat(item.price) : item.price,
                            description: item.description ?? "",
                            isFood: item.is_food ?? false,
                            isHot: item.is_hot ?? false,
                            isCold: item.is_cold ?? false,
                            isVegan: item.is_vegan ?? false,
                            isVegetarian: item.is_vegetarian ?? false,
                            calories: item.calories != null ? String(item.calories) : "",
                            sizeOptions: [],
                            isExpanded: !!(item.is_food || item.is_hot || item.is_cold || item.is_vegan || item.is_vegetarian || item.description || item.calories),
                        })
                    )
                    setExtractedItems(editableItems)
                    setDuplicates(data.duplicates ?? [])
                    setTimeout(() => setStep("review"), 300)
                },
                onError: (errorMsg) => {
                    setError(errorMsg)
                    setStep("upload")
                },
            })
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

    const handleUpdateItem = (id: number, field: keyof EditableItem, value: string | number | boolean | { label: string; price: number }[]) => {
        setExtractedItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        )
    }

    const handleToggleExpand = (id: number) => {
        setExtractedItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, isExpanded: !item.isExpanded } : item
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
                                            <AnimatePresence mode="wait">
                                                <motion.span
                                                    key={statusMessage}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="text-text/70 font-medium"
                                                >
                                                    {statusMessage}
                                                </motion.span>
                                            </AnimatePresence>
                                        </div>

                                        {streamedContent && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                className="max-h-28 overflow-y-auto bg-text/5 rounded-xl p-3 border border-text/10"
                                            >
                                                <p className="text-xs text-text/50 font-mono leading-relaxed break-words whitespace-pre-wrap">
                                                    {streamedContent}
                                                    <motion.span
                                                        animate={{ opacity: [1, 0] }}
                                                        transition={{ duration: 0.5, repeat: Infinity }}
                                                        className="inline-block w-1.5 h-3.5 bg-primary/60 rounded-sm align-middle ml-0.5"
                                                    />
                                                </p>
                                            </motion.div>
                                        )}

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
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
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
                                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
                                                    {extractedItems.length} items
                                                </motion.span>
                                            </div>

                                            <motion.div initial="hidden" animate="visible" className="space-y-2">
                                                {extractedItems.map((item, idx) => (
                                                    <motion.div key={item.id} custom={idx} variants={itemVariants}
                                                        initial="hidden" animate="visible" exit="exit" layout
                                                        className="group border border-text/10 rounded-xl overflow-hidden bg-text/[0.02] hover:bg-text/[0.04] transition-colors"
                                                    >
                                                        {/* Compact Row */}
                                                        <div className="flex items-center gap-2 p-3">
                                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                                                {idx + 1}
                                                            </div>
                                                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                <input type="text" value={item.name}
                                                                    onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                                                                    className="px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                                                    placeholder="Item name" />
                                                                <select value={item.category}
                                                                    onChange={(e) => handleUpdateItem(item.id, "category", e.target.value)}
                                                                    className="px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer">
                                                                    {MENU_CATEGORIES.map((cat) => (
                                                                        <option key={cat} value={cat}>{cat}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text/40 text-sm">₱</span>
                                                                    <input type="number" step="0.01" min="0" value={item.price}
                                                                        onChange={(e) => handleUpdateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                                                                        className="w-full pl-7 pr-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                                                                </div>
                                                            </div>
                                                            {/* Active flags badges */}
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {item.isFood && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">Food</span>}
                                                                {item.isHot && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Hot</span>}
                                                                {item.isCold && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">Cold</span>}
                                                            </div>
                                                            {/* Expand toggle */}
                                                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                                onClick={() => handleToggleExpand(item.id)}
                                                                className="p-2 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text cursor-pointer">
                                                                <motion.div animate={{ rotate: item.isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                                                    <ChevronDown className="w-4 h-4" />
                                                                </motion.div>
                                                            </motion.button>
                                                            {/* Delete */}
                                                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-text/30 hover:text-destructive cursor-pointer opacity-0 group-hover:opacity-100">
                                                                <Trash2 className="w-4 h-4" />
                                                            </motion.button>
                                                        </div>

                                                        {/* Expanded Panel */}
                                                        <AnimatePresence>
                                                            {item.isExpanded && (
                                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                                                    className="overflow-hidden">
                                                                    <div className="px-3 pb-3 pt-1 border-t border-text/5 space-y-3">
                                                                        {/* Description */}
                                                                        <div>
                                                                            <label className="text-xs font-medium text-text/50 mb-1 block">Description</label>
                                                                            <textarea value={item.description} rows={2}
                                                                                onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                                                                                className="w-full px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                                                                                placeholder="Brief description..." />
                                                                        </div>
                                                                        {/* Type Toggles */}
                                                                        <div>
                                                                            <label className="text-xs font-medium text-text/50 mb-1 block">Item Type</label>
                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                                                                <CustomCheckbox checked={item.isFood} onChange={(v) => handleUpdateItem(item.id, "isFood", v)} label="Food" />
                                                                                <CustomCheckbox checked={item.isHot} onChange={(v) => handleUpdateItem(item.id, "isHot", v)} label="Hot" />
                                                                                <CustomCheckbox checked={item.isCold} onChange={(v) => handleUpdateItem(item.id, "isCold", v)} label="Cold" />
                                                                                <CustomCheckbox checked={item.isVegan} onChange={(v) => handleUpdateItem(item.id, "isVegan", v)} label="Vegan" />
                                                                                <CustomCheckbox checked={item.isVegetarian} onChange={(v) => handleUpdateItem(item.id, "isVegetarian", v)} label="Vegetarian" />
                                                                            </div>
                                                                        </div>
                                                                        {/* Calories */}
                                                                        <div>
                                                                            <label className="text-xs font-medium text-text/50 mb-1 block">Calories</label>
                                                                            <input type="number" min="0" value={item.calories}
                                                                                onChange={(e) => handleUpdateItem(item.id, "calories", e.target.value)}
                                                                                className="w-32 px-3 py-2 bg-background border border-text/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                                                                placeholder="e.g. 250" />
                                                                        </div>
                                                                        {/* Size Options */}
                                                                        <div>
                                                                            <div className="flex items-center justify-between mb-1">
                                                                                <label className="text-xs font-medium text-text/50">Size Options</label>
                                                                                <button type="button"
                                                                                    onClick={() => handleUpdateItem(item.id, "sizeOptions", [...item.sizeOptions, { label: "", price: 0 }])}
                                                                                    className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors cursor-pointer">
                                                                                    <Plus className="w-3 h-3" /> Add size
                                                                                </button>
                                                                            </div>
                                                                            {item.sizeOptions.length === 0 && (
                                                                                <p className="text-xs text-text/30 italic">No sizes added</p>
                                                                            )}
                                                                            {item.sizeOptions.map((opt, si) => (
                                                                                <div key={si} className="flex items-center gap-2 mt-1">
                                                                                    <input type="text" value={opt.label} placeholder="Size (e.g., Large)"
                                                                                        onChange={(e) => {
                                                                                            const updated = [...item.sizeOptions]
                                                                                            updated[si] = { ...updated[si], label: e.target.value }
                                                                                            handleUpdateItem(item.id, "sizeOptions", updated)
                                                                                        }}
                                                                                        className="flex-1 px-2 py-1.5 bg-background border border-text/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                                                                                    <input type="number" min="0" step="0.01" value={opt.price || ""} placeholder="Price"
                                                                                        onChange={(e) => {
                                                                                            const updated = [...item.sizeOptions]
                                                                                            updated[si] = { ...updated[si], price: parseFloat(e.target.value) || 0 }
                                                                                            handleUpdateItem(item.id, "sizeOptions", updated)
                                                                                        }}
                                                                                        className="w-24 px-2 py-1.5 bg-background border border-text/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                                                                                    <button type="button"
                                                                                        onClick={() => handleUpdateItem(item.id, "sizeOptions", item.sizeOptions.filter((_, i) => i !== si))}
                                                                                        className="p-1.5 text-text/30 hover:text-destructive rounded-lg transition-colors cursor-pointer">
                                                                                        <Trash2 className="w-3 h-3" />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
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
