"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { XIcon, Loader2, Check } from "lucide-react"
import { submitMenuItemSuggestion } from "@/app/api/actions/menu-suggestions"
import MenuItemFormFields from "./MenuItemFormFields"
import type { SizeOption } from "./MenuItemFormFields"
import { MENU_CATEGORIES } from "@/utils/types/owner"

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
                                        : "Log an Item"}
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
                                    <div className='w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center'>
                                        <Check className='w-8 h-8 text-primary' />
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
                                <MenuItemFormFields
                                    data={{
                                        name,
                                        category,
                                        price,
                                        description,
                                        isFood,
                                        isHot,
                                        isCold,
                                        isVegan,
                                        isVegetarian,
                                        calories,
                                        sizeOptions,
                                    }}
                                    onChange={(updates) => {
                                        if (updates.name !== undefined) setName(updates.name)
                                        if (updates.category !== undefined) setCategory(updates.category)
                                        if (updates.price !== undefined) setPrice(updates.price)
                                        if (updates.description !== undefined) setDescription(updates.description)
                                        if (updates.isFood !== undefined) setIsFood(updates.isFood)
                                        if (updates.isHot !== undefined) setIsHot(updates.isHot)
                                        if (updates.isCold !== undefined) setIsCold(updates.isCold)
                                        if (updates.isVegan !== undefined) setIsVegan(updates.isVegan)
                                        if (updates.isVegetarian !== undefined) setIsVegetarian(updates.isVegetarian)
                                        if (updates.calories !== undefined) setCalories(updates.calories)
                                        if (updates.sizeOptions !== undefined) setSizeOptions(updates.sizeOptions)
                                    }}
                                    error={error}
                                />
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
                                    "Log Item"
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
