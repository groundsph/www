"use client"

/**
 * MenuItemModal - Shared component for adding/editing cafe menu items.
 * Used by CafeEditor (admin) and CafeManagementClient (owner).
 */

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { type ColorScheme, getColorClasses } from "@/utils/hooks/cafe-form"
import {
    MENU_CATEGORIES,
    type MenuItemForm,
    type CafeMenuItem,
} from "@/utils/types/owner"

interface MenuItemModalProps {
    /** Whether the modal is open */
    open: boolean
    /** Close the modal */
    onClose: () => void
    /** Save the menu item (returns success) */
    onSave: (data: MenuItemForm) => Promise<boolean>
    /** Existing menu item (for editing) */
    editingItem?: CafeMenuItem | null
    /** Whether save is in progress */
    saving?: boolean
    /** Color scheme for theming */
    colorScheme?: ColorScheme
}

const DEFAULT_FORM: MenuItemForm = {
    category: "Coffee",
    name: "",
    description: "",
    price: 0,
    is_signature: false,
    is_available: true,
}

/**
 * Modal for creating or editing cafe menu items.
 * Includes name, category, price, description, and flags for signature/available.
 */
export default function MenuItemModal({
    open,
    onClose,
    onSave,
    editingItem,
    saving = false,
    colorScheme = "primary",
}: MenuItemModalProps) {
    const colors = getColorClasses(colorScheme)
    const [form, setForm] = useState<MenuItemForm>(DEFAULT_FORM)

    // Reset form when modal opens or editing item changes
    useEffect(() => {
        if (open) {
            if (editingItem) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setForm({
                    category: editingItem.category,
                    name: editingItem.name,
                    description: editingItem.description || "",
                    price: editingItem.price,
                    is_signature: editingItem.is_signature,
                    is_available: editingItem.is_available,
                })
            } else {
                setForm(DEFAULT_FORM)
            }
        }
    }, [open, editingItem])

    const handleSubmit = async () => {
        if (!form.name.trim()) return
        const success = await onSave(form)
        if (success) {
            onClose()
        }
    }

    if (!open) return null

    return (
        <div
            className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
            onClick={onClose}
        >
            <div
                className='bg-background rounded-2xl p-6 w-full max-w-md'
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className='text-xl font-semibold mb-4'>
                    {editingItem ? "Edit Menu Item" : "Add Menu Item"}
                </h2>

                <div className='space-y-4'>
                    {/* Name */}
                    <div>
                        <label className='block text-sm font-medium mb-1'>
                            Name *
                        </label>
                        <input
                            type='text'
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                            className={`w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                            placeholder='e.g., Iced Latte'
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className='block text-sm font-medium mb-1'>
                            Category
                        </label>
                        <select
                            value={form.category}
                            onChange={(e) =>
                                setForm({ ...form, category: e.target.value })
                            }
                            className={`w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                        >
                            {MENU_CATEGORIES.map((category) => (
                                <option
                                    key={category}
                                    value={category}
                                >
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Price */}
                    <div>
                        <label className='block text-sm font-medium mb-1'>
                            Price (₱)
                        </label>
                        <input
                            type='number'
                            min='0'
                            step='0.01'
                            value={form.price || ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    price: parseFloat(e.target.value) || 0,
                                })
                            }
                            className={`w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 ${colors.focusRing}`}
                            placeholder='0'
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className='block text-sm font-medium mb-1'>
                            Description
                        </label>
                        <textarea
                            value={form.description || ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    description: e.target.value,
                                })
                            }
                            rows={2}
                            className={`w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg resize-none focus:outline-none focus:ring-2 ${colors.focusRing}`}
                            placeholder='Optional description...'
                        />
                    </div>

                    {/* Flags */}
                    <div className='flex gap-4'>
                        <label className='flex items-center gap-2 cursor-pointer'>
                            <input
                                type='checkbox'
                                checked={form.is_signature || false}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        is_signature: e.target.checked,
                                    })
                                }
                                className={`rounded border-text/20 ${colors.text}`}
                            />
                            <span className='text-sm'>Signature</span>
                        </label>
                        <label className='flex items-center gap-2 cursor-pointer'>
                            <input
                                type='checkbox'
                                checked={form.is_available ?? true}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        is_available: e.target.checked,
                                    })
                                }
                                className={`rounded border-text/20 ${colors.text}`}
                            />
                            <span className='text-sm'>Available</span>
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className='flex gap-3 mt-6'>
                    <button
                        type='button'
                        onClick={onClose}
                        className='flex-1 px-4 py-2 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition'
                    >
                        Cancel
                    </button>
                    <button
                        type='button'
                        onClick={handleSubmit}
                        disabled={saving || !form.name.trim()}
                        className={`flex-1 px-4 py-2 ${colors.bg} text-white rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2`}
                    >
                        {saving && <Loader2 className='w-4 h-4 animate-spin' />}
                        {saving ? "Saving..." : editingItem ? "Save" : "Add"}
                    </button>
                </div>
            </div>
        </div>
    )
}
