"use client"

import { useState, useRef, useEffect } from "react"
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
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
    const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node
            // Check if click is outside all dropdowns and buttons
            const isOutside = !Array.from(buttonRefs.current.values()).some(btn => btn.contains(target))
            if (isOutside) {
                setOpenDropdownId(null)
                setDropdownPosition(null)
            }
        }

        if (openDropdownId) {
            document.addEventListener("mousedown", handleClickOutside)
            // Calculate position
            const button = buttonRefs.current.get(openDropdownId)
            if (button) {
                const rect = button.getBoundingClientRect()
                const dropdownHeight = 280
                const spaceBelow = window.innerHeight - rect.bottom
                const showAbove = spaceBelow < dropdownHeight

                if (showAbove) {
                    // Position above button
                    setDropdownPosition({
                        top: rect.top + window.scrollY - dropdownHeight - 4,
                        left: Math.min(
                            rect.right + window.scrollX - 176, // Align right edge (176 = w-44)
                            window.innerWidth - 190 // Prevent overflow on right
                        ),
                    })
                } else {
                    // Position below button
                    setDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: Math.min(
                            rect.right + window.scrollX - 176, // Align right edge (176 = w-44)
                            window.innerWidth - 190 // Prevent overflow on right
                        ),
                    })
                }
            }
        }
        
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [openDropdownId])

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
                <PackagePlus className="w-12 h-12 text-text/30 mx-auto mb-4" />
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
                                            ref={(el) => {
                                                if (el) buttonRefs.current.set(item.id, el)
                                            }}
                                            onClick={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
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

            {/* Fixed Position Dropdown */}
            {openDropdownId && dropdownPosition && (() => {
                const item = items.find(i => i.id === openDropdownId)
                if (!item) return null
                return (
                    <div
                        className="fixed w-44 bg-background border border-text/10 rounded-lg shadow-lg z-[100] py-1"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                        }}
                    >
                        <button
                            onClick={() => {
                                onEdit(item)
                                setOpenDropdownId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <Edit3 className="w-4 h-4" />
                            Edit
                        </button>
                        <button
                            onClick={() => {
                                onAdjustStock(item)
                                setOpenDropdownId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            Adjust Stock
                        </button>
                        <button
                            onClick={() => {
                                onRestock(item)
                                setOpenDropdownId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <PackagePlus className="w-4 h-4" />
                            Restock
                        </button>
                        <button
                            onClick={() => {
                                onDuplicate(item)
                                setOpenDropdownId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <Copy className="w-4 h-4" />
                            Duplicate
                        </button>
                        <button
                            onClick={() => {
                                onHistory(item)
                                setOpenDropdownId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-text/5 transition-colors flex items-center gap-2"
                        >
                            <History className="w-4 h-4" />
                            History
                        </button>
                        <div className="border-t border-text/10 my-1" />
                        <button
                            onClick={() => {
                                onDelete(item)
                                setOpenDropdownId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            {item.status === "active" ? "Delete" : "Restore"}
                        </button>
                        
                        {/* Permanent Delete - only for inactive items */}
                        {item.status === "inactive" && onPermanentDelete && (
                            <button
                                onClick={() => {
                                    onPermanentDelete(item)
                                    setOpenDropdownId(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-100 text-red-700 transition-colors flex items-center gap-2"
                            >
                                <Trash className="w-4 h-4" />
                                Delete Permanently
                            </button>
                        )}
                    </div>
                )
            })()}
        </>
    )
}
