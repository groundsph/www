"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { XIcon, Loader2, Plus, Trash2, Check } from "lucide-react"
import { submitMenuItemSuggestion } from "@/app/api/actions/menu-suggestions"
import { MENU_CATEGORIES } from "@/utils/types/owner"

interface SizeOption {
    label: string
    price: number
}

interface SuggestMenuItemModalProps {
    isOpen: boolean
    onClose: () => void
    cafeId: string
    cafeName: string
    mode?: "add" | "edit"
    existingItem?: {
        id: string
        name: string
        category: string
        price: number
        description: string | null
    }
}

export default function SuggestMenuItemModal({
    isOpen,
    onClose,
    cafeId,
    cafeName,
    mode = "add",
    existingItem,
}: SuggestMenuItemModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Form state
    const [name, setName] = useState("")
    const [category, setCategory] = useState<string>(MENU_CATEGORIES[0])
    const [price, setPrice] = useState("")
    const [description, setDescription] = useState("")
    const [isFood, setIsFood] = useState(false)
    const [isHot, setIsHot] = useState(false)
    const [isCold, setIsCold] = useState(false)
    const [isVegan, setIsVegan] = useState(false)
    const [isVegetarian, setIsVegetarian] = useState(false)
    const [calories, setCalories] = useState("")
    const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([])

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (existingItem && mode === "edit") {
                setName(existingItem.name)
                setCategory(existingItem.category)
                setPrice(existingItem.price.toString())
                setDescription(existingItem.description || "")
            } else {
                setName("")
                setCategory(MENU_CATEGORIES[0])
                setPrice("")
                setDescription("")
            }
            setIsFood(false)
            setIsHot(false)
            setIsCold(false)
            setIsVegan(false)
            setIsVegetarian(false)
            setCalories("")
            setSizeOptions([])
            setError(null)
            setSuccess(false)
        }
    }, [isOpen, existingItem, mode])

    // Auto-close on success after 2 seconds
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                onClose()
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [success, onClose])

    const addSizeOption = () => {
        setSizeOptions([...sizeOptions, { label: "", price: 0 }])
    }

    const removeSizeOption = (index: number) => {
        setSizeOptions(sizeOptions.filter((_, i) => i !== index))
    }

    const updateSizeOption = (
        index: number,
        field: keyof SizeOption,
        value: string | number,
    ) => {
        const updated = [...sizeOptions]
        updated[index] = { ...updated[index], [field]: value }
        setSizeOptions(updated)
    }

    const validateForm = (): boolean => {
        if (!name.trim()) {
            setError("Name is required")
            return false
        }
        if (!category) {
            setError("Category is required")
            return false
        }
        if (!price || parseFloat(price) < 0) {
            setError("Price is required and must be 0 or greater")
            return false
        }
        return true
    }

    const handleSubmit = async () => {
        if (!validateForm()) return

        setIsSubmitting(true)
        setError(null)

        try {
            const result = await submitMenuItemSuggestion(
                cafeId,
                mode,
                {
                    name: name.trim(),
                    category,
                    price: parseFloat(price),
                    description: description.trim() || undefined,
                    is_food: isFood,
                    is_hot: isHot,
                    is_cold: isCold,
                    is_vegan: isVegan,
                    is_vegetarian: isVegetarian,
                    calories: calories ? parseInt(calories, 10) : null,
                    size_options:
                        sizeOptions.length > 0
                            ? sizeOptions.map((opt) => ({
                                  label: opt.label,
                                  price: opt.price,
                              }))
                            : null,
                },
                mode === "edit" ? existingItem?.id : undefined,
            )

            if (result.success) {
                setSuccess(true)
            } else {
                setError(result.error || "Failed to submit suggestion")
            }
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "An unexpected error occurred",
            )
        } finally {
            setIsSubmitting(false)
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
                        onClick={onClose}
                        className='fixed inset-0 bg-black/40 z-50 backdrop-blur-sm'
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className='fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg mx-4 bg-background text-text rounded-xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden border border-text/10'
                    >
                        {/* Header */}
                        <div className='flex items-center justify-between p-4 border-b border-text/10'>
                            <div>
                                <span className='text-xs font-medium tracking-wide uppercase text-text/50'>
                                    {mode === "edit"
                                        ? "Suggest Edit"
                                        : "Suggest Menu Item"}
                                </span>
                                <h2 className='text-xl font-serif font-semibold text-text'>
                                    {cafeName}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className='p-2 hover:bg-text/10 rounded-lg transition-colors text-text/40 hover:text-text cursor-pointer'
                            >
                                <XIcon className='w-5 h-5' />
                            </button>
                        </div>

                        {/* Content */}
                        <div className='flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar'>
                            {success ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className='flex flex-col items-center justify-center py-12 gap-4'
                                >
                                    <div className='w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center'>
                                        <Check className='w-8 h-8 text-green-500' />
                                    </div>
                                    <div className='text-center'>
                                        <h3 className='text-lg font-semibold'>
                                            Suggestion Submitted!
                                        </h3>
                                        <p className='text-text/60 text-sm mt-1'>
                                            Thank you for helping improve our
                                            menu listings.
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <>
                                    {/* Photo Upload Notice */}
                                    <div className='bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800'>
                                        <p className='flex items-center gap-2'>
                                            <span className='font-medium'>
                                                Note:
                                            </span>
                                            Photo uploads are not available for
                                            community suggestions.
                                        </p>
                                    </div>

                                    {/* Error Message */}
                                    {error && (
                                        <div className='bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700'>
                                            {error}
                                        </div>
                                    )}

                                    {/* Name */}
                                    <div className='space-y-2'>
                                        <label className='text-sm font-medium text-text/80'>
                                            Name{" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        </label>
                                        <input
                                            type='text'
                                            value={name}
                                            onChange={(e) =>
                                                setName(e.target.value)
                                            }
                                            placeholder='e.g., Iced Caramel Latte'
                                            className='w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text'
                                        />
                                    </div>

                                    {/* Category */}
                                    <div className='space-y-2'>
                                        <label className='text-sm font-medium text-text/80'>
                                            Category{" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        </label>
                                        <select
                                            value={category}
                                            onChange={(e) =>
                                                setCategory(e.target.value)
                                            }
                                            className='w-full bg-text/5 text-sm focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text'
                                        >
                                            {MENU_CATEGORIES.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Price */}
                                    <div className='space-y-2'>
                                        <label className='text-sm font-medium text-text/80'>
                                            Price (₱){" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        </label>
                                        <input
                                            type='number'
                                            min='0'
                                            step='0.01'
                                            value={price}
                                            onChange={(e) =>
                                                setPrice(e.target.value)
                                            }
                                            placeholder='0.00'
                                            className='w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text'
                                        />
                                    </div>

                                    {/* Description */}
                                    <div className='space-y-2'>
                                        <label className='text-sm font-medium text-text/80'>
                                            Description{" "}
                                            <span className='text-text/50'>
                                                (optional)
                                            </span>
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) =>
                                                setDescription(e.target.value)
                                            }
                                            placeholder='Brief description of the item...'
                                            rows={3}
                                            className='w-full bg-text/5 text-sm leading-relaxed placeholder:text-text/30 focus:outline-none p-3 resize-none rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text'
                                        />
                                    </div>

                                    {/* Type Toggles */}
                                    <div className='space-y-3'>
                                        <label className='text-sm font-medium text-text/80'>
                                            Item Type
                                        </label>
                                        <div className='grid grid-cols-2 gap-3'>
                                            <label className='flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-text/5 transition-colors'>
                                                <input
                                                    type='checkbox'
                                                    checked={isFood}
                                                    onChange={(e) =>
                                                        setIsFood(
                                                            e.target.checked,
                                                        )
                                                    }
                                                    className='rounded border-text/20 text-primary focus:ring-primary'
                                                />
                                                <span className='text-sm'>
                                                    Food
                                                </span>
                                            </label>
                                            <label className='flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-text/5 transition-colors'>
                                                <input
                                                    type='checkbox'
                                                    checked={isHot}
                                                    onChange={(e) =>
                                                        setIsHot(
                                                            e.target.checked,
                                                        )
                                                    }
                                                    className='rounded border-text/20 text-primary focus:ring-primary'
                                                />
                                                <span className='text-sm'>
                                                    Hot
                                                </span>
                                            </label>
                                            <label className='flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-text/5 transition-colors'>
                                                <input
                                                    type='checkbox'
                                                    checked={isCold}
                                                    onChange={(e) =>
                                                        setIsCold(
                                                            e.target.checked,
                                                        )
                                                    }
                                                    className='rounded border-text/20 text-primary focus:ring-primary'
                                                />
                                                <span className='text-sm'>
                                                    Cold
                                                </span>
                                            </label>
                                            <label className='flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-text/5 transition-colors'>
                                                <input
                                                    type='checkbox'
                                                    checked={isVegan}
                                                    onChange={(e) =>
                                                        setIsVegan(
                                                            e.target.checked,
                                                        )
                                                    }
                                                    className='rounded border-text/20 text-primary focus:ring-primary'
                                                />
                                                <span className='text-sm'>
                                                    Vegan
                                                </span>
                                            </label>
                                            <label className='flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-text/5 transition-colors col-span-2'>
                                                <input
                                                    type='checkbox'
                                                    checked={isVegetarian}
                                                    onChange={(e) =>
                                                        setIsVegetarian(
                                                            e.target.checked,
                                                        )
                                                    }
                                                    className='rounded border-text/20 text-primary focus:ring-primary'
                                                />
                                                <span className='text-sm'>
                                                    Vegetarian
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Calories */}
                                    <div className='space-y-2'>
                                        <label className='text-sm font-medium text-text/80'>
                                            Calories{" "}
                                            <span className='text-text/50'>
                                                (optional)
                                            </span>
                                        </label>
                                        <input
                                            type='number'
                                            min='0'
                                            value={calories}
                                            onChange={(e) =>
                                                setCalories(e.target.value)
                                            }
                                            placeholder='e.g., 250'
                                            className='w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text'
                                        />
                                    </div>

                                    {/* Size Options */}
                                    <div className='space-y-3'>
                                        <div className='flex items-center justify-between'>
                                            <label className='text-sm font-medium text-text/80'>
                                                Size Options{" "}
                                                <span className='text-text/50'>
                                                    (optional)
                                                </span>
                                            </label>
                                            <button
                                                type='button'
                                                onClick={addSizeOption}
                                                className='text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors cursor-pointer'
                                            >
                                                <Plus className='w-3.5 h-3.5' />
                                                Add size
                                            </button>
                                        </div>

                                        {sizeOptions.map((option, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{
                                                    opacity: 0,
                                                    height: 0,
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    height: "auto",
                                                }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className='flex items-center gap-2'
                                            >
                                                <input
                                                    type='text'
                                                    value={option.label}
                                                    onChange={(e) =>
                                                        updateSizeOption(
                                                            index,
                                                            "label",
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder='Size (e.g., Large)'
                                                    className='flex-1 bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-2.5 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text'
                                                />
                                                <input
                                                    type='number'
                                                    min='0'
                                                    step='0.01'
                                                    value={
                                                        option.price || ""
                                                    }
                                                    onChange={(e) =>
                                                        updateSizeOption(
                                                            index,
                                                            "price",
                                                            parseFloat(
                                                                e.target.value,
                                                            ) || 0,
                                                        )
                                                    }
                                                    placeholder='Price'
                                                    className='w-28 bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-2.5 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text'
                                                />
                                                <button
                                                    type='button'
                                                    onClick={() =>
                                                        removeSizeOption(index)
                                                    }
                                                    className='p-2.5 text-text/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer'
                                                >
                                                    <Trash2 className='w-4 h-4' />
                                                </button>
                                            </motion.div>
                                        ))}

                                        {sizeOptions.length === 0 && (
                                            <p className='text-sm text-text/40 italic'>
                                                No size options added. Click
                                                &quot;Add size&quot; to add
                                                options like Small, Medium,
                                                Large.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!success && (
                            <div className='p-4 border-t border-text/10 flex gap-3'>
                                <button
                                    type='button'
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className='flex-1 px-4 py-2.5 bg-text/10 hover:bg-text/20 text-text rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='button'
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className='flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer'
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className='w-4 h-4 animate-spin' />
                                            Submitting...
                                        </>
                                    ) : mode === "edit" ? (
                                        "Suggest Edit"
                                    ) : (
                                        "Suggest Item"
                                    )}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
