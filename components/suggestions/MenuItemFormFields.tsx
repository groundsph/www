"use client"

import { motion, AnimatePresence } from "motion/react"
import { Plus, Trash2 } from "lucide-react"
import { MENU_CATEGORIES } from "@/utils/types/owner"
import { cn } from "@/utils/cn"

export interface SizeOption {
    label: string
    price: number
}

export interface MenuItemFormData {
    name: string
    category: string
    price: string
    description: string
    isFood: boolean
    isHot: boolean
    isCold: boolean
    isVegan: boolean
    isVegetarian: boolean
    calories: string
    sizeOptions: SizeOption[]
}

export interface MenuItemFormFieldsProps {
    /** Form data state */
    data: MenuItemFormData
    /** Callback to update form data */
    onChange: (data: Partial<MenuItemFormData>) => void
    /** Optional error message to display */
    error?: string | null
    /** Whether to show the image upload section */
    showImageUpload?: boolean
    /** Custom className for the container */
    className?: string
}

const typeToggles = [
    { key: "isFood", label: "Food" },
    { key: "isHot", label: "Hot" },
    { key: "isCold", label: "Cold" },
    { key: "isVegan", label: "Vegan" },
    { key: "isVegetarian", label: "Vegetarian" },
] as const

/**
 * Custom checkbox component with theme-based styling
 */
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
        <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-text/5 transition-colors">
            <div
                className={cn(
                    "relative w-5 h-5 border-2 rounded flex items-center justify-center transition-all duration-200",
                    checked
                        ? "border-primary/30 bg-primary/5"
                        : "border-text/10 bg-text/5"
                )}
            >
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only"
                />
                <svg
                    className={cn(
                        "w-3 h-3 transition-all duration-200",
                        checked ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    )}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </div>
            <span
                className={cn(
                    "text-sm transition-colors duration-200",
                    checked ? "text-text" : "text-text/60"
                )}
            >
                {label}
            </span>
        </label>
    )
}

/**
 * Shared form fields component for menu item forms.
 * Used by SuggestMenuItemModal and CafeSubmissionForm.
 */
export default function MenuItemFormFields({
    data,
    onChange,
    error,
    showImageUpload = false,
    className,
}: MenuItemFormFieldsProps) {
    const handleAddSizeOption = () => {
        onChange({
            sizeOptions: [...data.sizeOptions, { label: "", price: 0 }],
        })
    }

    const handleRemoveSizeOption = (index: number) => {
        onChange({
            sizeOptions: data.sizeOptions.filter((_, i) => i !== index),
        })
    }

    const handleUpdateSizeOption = (
        index: number,
        field: keyof SizeOption,
        value: string | number
    ) => {
        const updated = [...data.sizeOptions]
        updated[index] = { ...updated[index], [field]: value }
        onChange({ sizeOptions: updated })
    }

    const handleToggleChange = (key: keyof MenuItemFormData, value: boolean) => {
        onChange({ [key]: value })
    }

    return (
        <div className={cn("space-y-5", className)}>
            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Upload Section (Optional) */}
            {showImageUpload && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-text/80 text-left">
                        Item Photo{" "}
                        <span className="text-text/50">(optional)</span>
                    </label>
                    <div className="border-2 border-dashed border-text/20 rounded-lg p-6 text-center hover:border-primary/30 transition-colors cursor-pointer bg-text/5">
                        <div className="text-text/40 text-sm">
                            <span className="text-primary">Click to upload</span> or
                            drag and drop
                        </div>
                        <p className="text-text/30 text-xs mt-1">
                            PNG, JPG up to 5MB
                        </p>
                    </div>
                </div>
            )}

            {/* Name */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text/80 text-left">
                    Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={data.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    placeholder="e.g., Iced Caramel Latte"
                    className="w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                />
            </div>

            {/* Category */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text/80 text-left">
                    Category <span className="text-red-500">*</span>
                </label>
                <select
                    value={data.category}
                    onChange={(e) => onChange({ category: e.target.value })}
                    className="w-full bg-text/5 text-sm focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                >
                    {MENU_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat}
                        </option>
                    ))}
                </select>
            </div>

            {/* Price */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text/80 text-left">
                    Price (₱) <span className="text-red-500">*</span>
                </label>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.price}
                    onChange={(e) => onChange({ price: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                />
            </div>

            {/* Description */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text/80 text-left">
                    Description{" "}
                    <span className="text-text/50">(optional)</span>
                </label>
                <textarea
                    value={data.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    placeholder="Brief description of the item..."
                    rows={3}
                    className="w-full bg-text/5 text-sm leading-relaxed placeholder:text-text/30 focus:outline-none p-3 resize-none rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                />
            </div>

            {/* Type Toggles */}
            <div className="space-y-3">
                <label className="block text-sm font-medium text-text/80 text-left">
                    Item Type
                </label>
                <div className="grid grid-cols-2 gap-1">
                    {typeToggles.map(({ key, label }) => (
                        <CustomCheckbox
                            key={key}
                            checked={data[key as keyof MenuItemFormData] as boolean}
                            onChange={(checked) =>
                                handleToggleChange(key as keyof MenuItemFormData, checked)
                            }
                            label={label}
                        />
                    ))}
                </div>
            </div>

            {/* Calories */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-text/80 text-left">
                    Calories <span className="text-text/50">(optional)</span>
                </label>
                <input
                    type="number"
                    min="0"
                    value={data.calories}
                    onChange={(e) => onChange({ calories: e.target.value })}
                    placeholder="e.g., 250"
                    className="w-full bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-3 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                />
            </div>

            {/* Size Options */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-text/80 text-left">
                        Size Options{" "}
                        <span className="text-text/50">(optional)</span>
                    </label>
                    <button
                        type="button"
                        onClick={handleAddSizeOption}
                        className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add size
                    </button>
                </div>

                <AnimatePresence mode="popLayout">
                    {data.sizeOptions.map((option, index) => (
                        <motion.div
                            key={index}
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-2"
                        >
                            <input
                                type="text"
                                value={option.label}
                                onChange={(e) =>
                                    handleUpdateSizeOption(
                                        index,
                                        "label",
                                        e.target.value
                                    )
                                }
                                placeholder="Size (e.g., Large)"
                                className="flex-1 bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-2.5 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                            />
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={option.price || ""}
                                onChange={(e) =>
                                    handleUpdateSizeOption(
                                        index,
                                        "price",
                                        parseFloat(e.target.value) || 0
                                    )
                                }
                                placeholder="Price"
                                className="w-28 bg-text/5 text-sm placeholder:text-text/30 focus:outline-none p-2.5 rounded-lg border border-text/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-text"
                            />
                            <button
                                type="button"
                                onClick={() => handleRemoveSizeOption(index)}
                                className="p-2.5 text-text/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {data.sizeOptions.length === 0 && (
                    <p className="text-sm text-text/40 italic text-left">
                        No size options added. Click &quot;Add size&quot; to add
                        options like Small, Medium, Large.
                    </p>
                )}
            </div>
        </div>
    )
}
