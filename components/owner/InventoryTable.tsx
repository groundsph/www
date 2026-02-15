"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { InventoryItem } from "@/utils/types/inventory"
import {
    MoreVertical,
    Edit3,
    SlidersHorizontal,
    PackagePlus,
    Copy,
    History,
    Trash2,
    AlertTriangle,
    ExternalLink,
    Trash,
} from "lucide-react"

interface InventoryTableProps {
    items: InventoryItem[]
    loading?: boolean
    onEdit: (item: InventoryItem) => void
    onAdjustStock: (item: InventoryItem) => void
    onRestock: (item: InventoryItem) => void
    onDuplicate: (item: InventoryItem) => void
    onHistory: (item: InventoryItem) => void
    onDelete: (item: InventoryItem) => void
    onPermanentDelete?: (item: InventoryItem) => void
}

export default function InventoryTable({
    items,
    loading,
    onEdit,
    onAdjustStock,
    onRestock,
    onDuplicate,
    onHistory,
    onDelete,
    onPermanentDelete,
}: InventoryTableProps) {
    const [openDropdownItem, setOpenDropdownItem] = useState<InventoryItem | null>(null)
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdownItem(null)
                setDropdownPosition(null)
            }
        }

        if (openDropdownItem) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [openDropdownItem])

    // Handle scroll to close dropdown
    useEffect(() => {
        function handleScroll() {
            setOpenDropdownItem(null)
            setDropdownPosition(null)
        }

        if (openDropdownItem) {
            window.addEventListener("scroll", handleScroll, true)
        }
        
        return () => window.removeEventListener("scroll", handleScroll, true)
    }, [openDropdownItem])

    const handleButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>, item: InventoryItem) => {
        e.stopPropagation()
        
        if (openDropdownItem?.id === item.id) {
            setOpenDropdownItem(null)
            setDropdownPosition(null)
            return
        }

        // Get click position relative to viewport
        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX
        const clickY = e.clientY
        
        // Dropdown dimensions
        const dropdownWidth = 176 // w-44
        const dropdownHeight = 320 // Approximate height
        
        // Calculate position - try to position near the click but within viewport
        let left = clickX - dropdownWidth + 20 // Offset slightly to the left of click
        let top = clickY
        
        // Ensure dropdown stays within viewport
        if (left < 8) left = 8
        if (left + dropdownWidth > window.innerWidth - 8) {
            left = window.innerWidth - dropdownWidth - 8
        }
        
        // If too close to bottom, show above
        if (top + dropdownHeight > window.innerHeight - 8) {
            top = rect.top - dropdownHeight - 4
        } else {
            top = rect.bottom + 4
        }
        
        // Ensure not above viewport
        if (top < 8) top = 8
        
        setDropdownPosition({ top, left })
        setOpenDropdownItem(item)
    }, [openDropdownItem])

    const handleAction = useCallback((action: (item: InventoryItem) => void) => {
        if (openDropdownItem) {
            action(openDropdownItem)
            setOpenDropdownItem(null)
            setDropdownPosition(null)
        }
    }, [openDropdownItem])

    if (loading) {
        return (
            <div className="border border-text/10 rounded-xl overflow-hidden">
                <div className="animate-pulse">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 border-b border-text/10 last:border-b-0">
                            <div className="h-12 bg-text/5 rounded-lg"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12 border border-text/10 rounded-xl bg-text/5">
                <PackagePlus className="w-12 h-12 text-text opacity-30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text/60">No items found</h3>
                <p className="text-sm text-text/40 mt-1">
                    Try adjusting your filters or add a new item
                </p>
            </div>
        )
    }

    const isLowStock = (item: InventoryItem) => item.stock <= item.warningThreshold

    return (
        <>
            <div className="border border-text/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-text/5 border-b border-text/10">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">Name</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-text/60">Category</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-text/60">Stock</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-text/60 hidden sm:table-cell">Warning</th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-text/60">Status</th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-text/60">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-text/10">
                            {items.map((item) => (
                                <tr
                                    key={item.id}
                                    className={`hover:bg-text/5 transition-colors ${item.status === "inactive" ? "opacity-60" : ""}`}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{item.name}</span>
                                            {item.link && (
                                                <a
                                                    href={item.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-text/40 hover:text-primary transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                        {item.sku && (
                                            <span className="text-xs text-text/40">SKU: {item.sku}</span>
                                        )}
                                        {isLowStock(item) && item.status === "active" && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                                <span className="text-xs text-amber-600 font-medium">Low Stock</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-text/80">{item.category}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`font-medium ${isLowStock(item) && item.status === "active" ? "text-amber-600" : ""}`}>
                                            {item.stock}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-text/60 hidden sm:table-cell">
                                        {item.warningThreshold}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                item.status === "active"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            {item.status === "active" ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={(e) => handleButtonClick(e, item)}
                                            className="p-2 hover:bg-text/10 rounded-lg transition-colors"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Portal Dropdown */}
            {openDropdownItem && dropdownPosition && typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={dropdownRef}
                        className="fixed w-44 bg-background border border-text/10 rounded-lg shadow-lg z-[9999] py-1"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => handleAction(onEdit)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <Edit3 className="w-4 h-4" />
                            Edit
                        </button>
                        <button
                            onClick={() => handleAction(onAdjustStock)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            Adjust Stock
                        </button>
                        <button
                            onClick={() => handleAction(onRestock)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <PackagePlus className="w-4 h-4" />
                            Restock
                        </button>
                        <button
                            onClick={() => handleAction(onDuplicate)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <Copy className="w-4 h-4" />
                            Duplicate
                        </button>
                        <button
                            onClick={() => handleAction(onHistory)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <History className="w-4 h-4" />
                            History
                        </button>
                        <div className="border-t border-text/10 my-1" />
                        <button
                            onClick={() => handleAction(onDelete)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            {openDropdownItem.status === "active" ? "Delete" : "Restore"}
                        </button>
                        
                        {/* Permanent Delete - only for inactive items */}
                        {openDropdownItem.status === "inactive" && onPermanentDelete && (
                            <button
                                onClick={() => handleAction(onPermanentDelete)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-100 text-red-700 transition-colors flex items-center gap-2"
                            >
                                <Trash className="w-4 h-4" />
                                Delete Permanently
                            </button>
                        )}
                    </div>,
                    document.body
                )}
        </>
    )
}
