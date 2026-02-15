"use client"

import { useState, useEffect, useRef } from "react"
import { InventoryItem } from "@/utils/types/inventory"
import { X, Loader2, Link2, Calendar, AlertCircle, ChevronDown } from "lucide-react"

interface InventoryItemModalProps {
    open: boolean
    onClose: () => void
    onSave: (data: Partial<InventoryItem>) => Promise<boolean>
    editingItem?: InventoryItem | null
    categories: string[]
    saving?: boolean
}

const DEFAULT_FORM: Partial<InventoryItem> = {
    name: "",
    sku: "",
    description: "",
    category: "",
    stock: 0,
    warningThreshold: 5,
    costPrice: null,
    expiryDate: null,
    link: null,
}

export default function InventoryItemModal({
    open,
    onClose,
    onSave,
    editingItem,
    categories,
    saving = false,
}: InventoryItemModalProps) {
    const [form, setForm] = useState<Partial<InventoryItem>>(DEFAULT_FORM)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
    const [categoryInput, setCategoryInput] = useState("")
    const dropdownRef = useRef<HTMLDivElement>(null)

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (open) {
            if (editingItem) {
                setForm({
                    name: editingItem.name,
                    sku: editingItem.sku ?? "",
                    description: editingItem.description ?? "",
                    category: editingItem.category,
                    stock: editingItem.stock,
                    warningThreshold: editingItem.warningThreshold,
                    costPrice: editingItem.costPrice,
                    expiryDate: editingItem.expiryDate?.split("T")[0] ?? null,
                    link: editingItem.link,
                })
                setCategoryInput(editingItem.category)
            } else {
                setForm(DEFAULT_FORM)
                setCategoryInput("")
            }
            setErrors({})
            setShowCategoryDropdown(false)
        }
    }, [open, editingItem])
    /* eslint-enable react-hooks/set-state-in-effect */

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowCategoryDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {}

        if (!form.name?.trim()) {
            newErrors.name = "Name is required"
        }

        if (!form.category?.trim()) {
            newErrors.category = "Category is required"
        }

        if (form.stock === undefined || form.stock < 0) {
            newErrors.stock = "Stock must be 0 or greater"
        }

        if (form.warningThreshold === undefined || form.warningThreshold < 0) {
            newErrors.warningThreshold = "Warning threshold must be 0 or greater"
        }

        if (form.link) {
            try {
                new URL(form.link)
            } catch {
                newErrors.link = "Must be a valid URL"
            }
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) return

        const success = await onSave(form)
        if (success) {
            onClose()
        }
    }

    const handleCategorySelect = (category: string) => {
        setForm({ ...form, category })
        setCategoryInput(category)
        setShowCategoryDropdown(false)
    }

    const handleCategoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setCategoryInput(value)
        setForm({ ...form, category: value })
    }

    const filteredCategories = categories.filter(cat => 
        cat.toLowerCase().includes(categoryInput.toLowerCase())
    )

    if (!open) return null

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-background rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">
                        {editingItem ? "Edit Item" : "New Item"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-text/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Name *
                        </label>
                        <input
                            type="text"
                            value={form.name ?? ""}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className={`w-full px-3 py-2 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                errors.name ? "border-red-300" : "border-text/10"
                            }`}
                            placeholder="e.g., Arabica Beans"
                        />
                        {errors.name && (
                            <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                        )}
                    </div>

                    {/* SKU */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            SKU
                        </label>
                        <input
                            type="text"
                            value={form.sku ?? ""}
                            onChange={(e) => setForm({ ...form, sku: e.target.value })}
                            className="w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Optional product code"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Description
                        </label>
                        <textarea
                            value={form.description ?? ""}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Optional description"
                        />
                    </div>

                    {/* Category - ComboBox Style */}
                    <div ref={dropdownRef}>
                        <label className="block text-sm font-medium mb-1">
                            Category *
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={categoryInput}
                                onChange={handleCategoryInputChange}
                                onFocus={() => setShowCategoryDropdown(true)}
                                placeholder="Type or select a category"
                                className={`w-full px-3 py-2 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 pr-10 ${
                                    errors.category ? "border-red-300" : "border-text/10"
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-text/10 rounded transition-colors"
                            >
                                <ChevronDown className={`w-4 h-4 text-text opacity-60 transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`} />
                            </button>
                            
                            {/* Dropdown */}
                            {showCategoryDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-text/10 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                    {filteredCategories.length > 0 ? (
                                        filteredCategories.map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => handleCategorySelect(cat)}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-text/5 transition-colors"
                                            >
                                                {cat}
                                            </button>
                                        ))
                                    ) : categoryInput.trim() ? (
                                        <div className="px-3 py-2 text-sm text-text/60">
                                            New category: &ldquo;{categoryInput}&rdquo;
                                        </div>
                                    ) : (
                                        <div className="px-3 py-2 text-sm text-text/40">
                                            Type to create a new category
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {errors.category && (
                            <p className="text-sm text-red-500 mt-1">{errors.category}</p>
                        )}
                    </div>

                    {/* Stock and Warning Threshold */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Stock *
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={form.stock ?? ""}
                                onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                                className={`w-full px-3 py-2 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                    errors.stock ? "border-red-300" : "border-text/10"
                                }`}
                            />
                            {errors.stock && (
                                <p className="text-sm text-red-500 mt-1">{errors.stock}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-text opacity-40" />
                                Warning At
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={form.warningThreshold ?? ""}
                                onChange={(e) => setForm({ ...form, warningThreshold: parseInt(e.target.value) || 0 })}
                                className={`w-full px-3 py-2 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                    errors.warningThreshold ? "border-red-300" : "border-text/10"
                                }`}
                            />
                            {errors.warningThreshold && (
                                <p className="text-sm text-red-500 mt-1">{errors.warningThreshold}</p>
                            )}
                        </div>
                    </div>

                    {/* Cost Price */}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Cost Price (₱)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.costPrice ?? ""}
                            onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || null })}
                            className="w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="0.00"
                        />
                    </div>

                    {/* Expiry Date */}
                    <div>
                        <label className="text-sm font-medium mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-text opacity-40" />
                            Expiry Date
                        </label>
                        <input
                            type="date"
                            value={form.expiryDate ?? ""}
                            onChange={(e) => setForm({ ...form, expiryDate: e.target.value || null })}
                            className="w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>

                    {/* Link */}
                    <div>
                        <label className="text-sm font-medium mb-1 flex items-center gap-1">
                            <Link2 className="w-3.5 h-3.5 text-text opacity-40" />
                            Product Link
                        </label>
                        <input
                            type="url"
                            value={form.link ?? ""}
                            onChange={(e) => setForm({ ...form, link: e.target.value || null })}
                            className={`w-full px-3 py-2 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                errors.link ? "border-red-300" : "border-text/10"
                            }`}
                            placeholder="https://..."
                        />
                        {errors.link && (
                            <p className="text-sm text-red-500 mt-1">{errors.link}</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? "Saving..." : editingItem ? "Save Changes" : "Create Item"}
                    </button>
                </div>
            </div>
        </div>
    )
}
