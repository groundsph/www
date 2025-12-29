"use client"

/**
 * Hook for managing cafe menu items with CRUD operations.
 * Used by CafeEditor (admin) and CafeManagementClient (owner).
 */

import { useState, useCallback } from "react"
import { type CafeMenuItem, type MenuItemForm } from "@/utils/types/owner"
import { addMenuItem, updateMenuItem, deleteMenuItem } from "@/app/api/actions/owner"

export interface UseMenuItemsOptions {
    /** Initial menu items */
    initialItems: CafeMenuItem[]
    /** Cafe ID for operations */
    cafeId: string
    /** Optional callback after successful operations */
    onSuccess?: () => void
    /** Optional error handler */
    onError?: (error: string) => void
}

export interface UseMenuItemsReturn {
    /** Current list of menu items */
    items: CafeMenuItem[]
    /** Whether an operation is in progress */
    loading: boolean
    /** Currently editing item (for modal) */
    editingItem: CafeMenuItem | null
    /** Whether the modal is open */
    modalOpen: boolean
    /** Open modal for creating new item */
    openCreateModal: () => void
    /** Open modal for editing existing item */
    openEditModal: (item: CafeMenuItem) => void
    /** Close the modal */
    closeModal: () => void
    /** Save a menu item (create or update) */
    saveItem: (data: MenuItemForm) => Promise<boolean>
    /** Delete a menu item */
    deleteItem: (item: CafeMenuItem) => Promise<boolean>
    /** Toggle item availability */
    toggleAvailability: (item: CafeMenuItem) => Promise<boolean>
}

/**
 * Hook for managing cafe menu items with full CRUD operations.
 * Handles modal state, loading states, and API calls.
 * 
 * @example
 * ```tsx
 * const menu = useMenuItems({
 *   initialItems: cafe.menu_items,
 *   cafeId: cafe.id,
 *   onError: (msg) => addNotification(msg, "error"),
 * })
 * 
 * // In JSX:
 * <button onClick={menu.openCreateModal}>Add Item</button>
 * <MenuItemModal
 *   open={menu.modalOpen}
 *   onClose={menu.closeModal}
 *   onSave={menu.saveItem}
 *   editingItem={menu.editingItem}
 *   saving={menu.loading}
 * />
 * ```
 */
export function useMenuItems(options: UseMenuItemsOptions): UseMenuItemsReturn {
    const { initialItems, cafeId, onSuccess, onError } = options

    const [items, setItems] = useState<CafeMenuItem[]>(initialItems)
    const [loading, setLoading] = useState(false)
    const [editingItem, setEditingItem] = useState<CafeMenuItem | null>(null)
    const [modalOpen, setModalOpen] = useState(false)

    const openCreateModal = useCallback(() => {
        setEditingItem(null)
        setModalOpen(true)
    }, [])

    const openEditModal = useCallback((item: CafeMenuItem) => {
        setEditingItem(item)
        setModalOpen(true)
    }, [])

    const closeModal = useCallback(() => {
        setModalOpen(false)
        setEditingItem(null)
    }, [])

    const saveItem = useCallback(
        async (data: MenuItemForm): Promise<boolean> => {
            setLoading(true)

            try {
                if (editingItem) {
                    // Update existing item
                    const result = await updateMenuItem(editingItem.id, data)
                    if (result.success) {
                        // updateMenuItem doesn't return the item, so we reconstruct it
                        const updatedItem: CafeMenuItem = {
                            ...editingItem,
                            ...data,
                            description: data.description || null,
                            image_url: data.image_url || editingItem.image_url,
                            is_signature: data.is_signature ?? editingItem.is_signature,
                            is_available: data.is_available ?? editingItem.is_available,
                            updated_at: new Date().toISOString(),
                        }
                        setItems((prev) =>
                            prev.map((item) =>
                                item.id === editingItem.id ? updatedItem : item
                            )
                        )
                        onSuccess?.()
                        return true
                    } else {
                        onError?.(result.error || "Failed to update menu item")
                        return false
                    }
                } else {
                    // Create new item
                    const result = await addMenuItem(cafeId, data)
                    if (result.success && result.item) {
                        setItems((prev) => [...prev, result.item!])
                        onSuccess?.()
                        return true
                    } else {
                        onError?.(result.error || "Failed to add menu item")
                        return false
                    }
                }
            } finally {
                setLoading(false)
            }
        },
        [cafeId, editingItem, onSuccess, onError]
    )

    const deleteItemFn = useCallback(
        async (item: CafeMenuItem): Promise<boolean> => {
            if (!confirm(`Delete "${item.name}"?`)) return false

            setLoading(true)
            try {
                const result = await deleteMenuItem(item.id)
                if (result.success) {
                    setItems((prev) => prev.filter((i) => i.id !== item.id))
                    onSuccess?.()
                    return true
                } else {
                    onError?.(result.error || "Failed to delete menu item")
                    return false
                }
            } finally {
                setLoading(false)
            }
        },
        [onSuccess, onError]
    )

    const toggleAvailability = useCallback(
        async (item: CafeMenuItem): Promise<boolean> => {
            const newAvailability = !item.is_available

            // Optimistically update UI
            setItems((prev) =>
                prev.map((i) =>
                    i.id === item.id ? { ...i, is_available: newAvailability } : i
                )
            )

            try {
                const result = await updateMenuItem(item.id, {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    is_available: newAvailability,
                })

                if (!result.success) {
                    // Revert on failure
                    setItems((prev) =>
                        prev.map((i) =>
                            i.id === item.id ? { ...i, is_available: item.is_available } : i
                        )
                    )
                    onError?.(result.error || "Failed to update availability")
                    return false
                }
                return true
            } catch {
                // Revert on error
                setItems((prev) =>
                    prev.map((i) =>
                        i.id === item.id ? { ...i, is_available: item.is_available } : i
                    )
                )
                onError?.("Failed to update availability")
                return false
            }
        },
        [onError]
    )

    return {
        items,
        loading,
        editingItem,
        modalOpen,
        openCreateModal,
        openEditModal,
        closeModal,
        saveItem,
        deleteItem: deleteItemFn,
        toggleAvailability,
    }
}
