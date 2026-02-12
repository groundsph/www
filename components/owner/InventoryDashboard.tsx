"use client"

import { useState, useEffect, useCallback } from "react"
import { InventoryItem, InventoryStats, InventoryRestockHistory } from "@/utils/types/inventory"
import { InventoryFiltersState } from "./InventoryFilters"
import { useNotification } from "@/components/layout/NotificationProvider"
import { motion } from "motion/react"
import { Plus, ArrowLeft } from "lucide-react"
import Link from "next/link"

// Components
import InventoryStatsCards from "./InventoryStatsCards"
import InventoryFilters from "./InventoryFilters"
import InventoryTable from "./InventoryTable"
import InventoryItemModal from "./InventoryItemModal"
import InventoryRestockModal from "./InventoryRestockModal"
import InventoryHistoryModal from "./InventoryHistoryModal"

// Actions
import {
    getInventoryItems,
    getInventoryStats,
    createInventoryItem,
    updateInventoryItem,
    softDeleteInventoryItem,
    restoreInventoryItem,
    deleteInventoryItem,
    adjustInventoryStock,
    restockInventoryItem,
    getRestockHistory,
    exportInventoryToCSV,
} from "@/app/api/actions/inventory"

interface InventoryDashboardProps {
    cafe: {
        id: string
        name: string
        slug: string
    }
    items: {
        success: boolean
        error?: string
        data?: {
            items: InventoryItem[]
        }
    }
    stats: {
        success: boolean
        error?: string
        data?: InventoryStats
    }
}

export default function InventoryDashboard({ cafe, items: initialItems, stats: initialStats }: InventoryDashboardProps) {
    const { addNotification } = useNotification()

    // Data state
    const [items, setItems] = useState<InventoryItem[]>(initialItems.data?.items ?? [])
    const [stats, setStats] = useState<InventoryStats | null>(initialStats.data ?? null)
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)

    // Filter state
    const [filters, setFilters] = useState<InventoryFiltersState>({
        search: "",
        category: "",
        lowStockOnly: false,
        status: "all",
    })

    // Modal state
    const [itemModalOpen, setItemModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

    const [restockModalOpen, setRestockModalOpen] = useState(false)
    const [restockingItem, setRestockingItem] = useState<InventoryItem | null>(null)

    const [historyModalOpen, setHistoryModalOpen] = useState(false)
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null)
    const [historyData, setHistoryData] = useState<InventoryRestockHistory[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Saving states
    const [savingItem, setSavingItem] = useState(false)
    const [savingRestock, setSavingRestock] = useState(false)

    // Derived categories from items
    const categories = Array.from(new Set(items.map((item) => item.category))).sort()

    // Helper function to calculate stats from items array
    const calculateStats = useCallback((currentItems: InventoryItem[]): InventoryStats => {
        console.log("[calculateStats] Calculating for", currentItems.length, "items")
        
        const totalItems = currentItems.length
        const lowStockCount = currentItems.filter(
            (item) => item.status === "active" && item.stock <= item.warningThreshold
        ).length
        
        // Valuation calculation - sum of (stock * costPrice) for active items
        let valuation = 0
        currentItems.forEach((item) => {
            if (item.status === "active" && item.costPrice && item.costPrice > 0) {
                const itemValue = item.stock * item.costPrice
                valuation += itemValue
                console.log(`[calculateStats] ${item.name}: ${item.stock} × ${item.costPrice} = ${itemValue}`)
            }
        })
        
        console.log("[calculateStats] Total valuation:", valuation)

        return {
            totalItems,
            lowStockCount,
            valuation,
        }
    }, [])

    // Fetch data
    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const [itemsResult, statsResult] = await Promise.all([
                getInventoryItems(cafe.id, filters),
                getInventoryStats(cafe.id),
            ])

            if (itemsResult.success && itemsResult.data) {
                setItems(itemsResult.data.items)
                // Also recalculate stats from items to ensure consistency
                setStats(calculateStats(itemsResult.data.items))
            } else {
                addNotification(itemsResult.error || "Failed to fetch items", "error")
            }

            if (statsResult.success && statsResult.data) {
                // Use server stats as source of truth, but only if items fetch succeeded
                if (!itemsResult.success) {
                    setStats(statsResult.data)
                }
            }
        } catch (error) {
            console.error("[InventoryDashboard] Error fetching data:", error)
            addNotification("Failed to load inventory data", "error")
        } finally {
            setLoading(false)
        }
    }, [cafe.id, filters, addNotification, calculateStats])

    // Initial fetch
    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Handle filter changes - debounced
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData()
        }, 300)

        return () => clearTimeout(timer)
    }, [filters, fetchData])

    // Create/Edit item
    const handleSaveItem = async (data: Partial<InventoryItem>): Promise<boolean> => {
        setSavingItem(true)
        
        // Save previous state for rollback
        const previousItems = [...items]
        const previousStats = stats
        
        try {
            if (editingItem) {
                // Update existing - optimistic update
                const updatedItem = { ...editingItem, ...data } as InventoryItem
                const updatedItems = items.map((item) =>
                    item.id === editingItem.id ? updatedItem : item
                )
                setItems(updatedItems)
                setStats(calculateStats(updatedItems))
                
                // Call API
                const result = await updateInventoryItem(editingItem.id, {
                    name: data.name!,
                    category: data.category!,
                    stock: data.stock,
                    warningThreshold: data.warningThreshold,
                    expiryDate: data.expiryDate || undefined,
                    link: data.link || undefined,
                })

                if (result.success) {
                    addNotification("Item updated successfully", "success")
                    // Silently refresh to get accurate server state
                    fetchData(true)
                    return true
                } else {
                    // Rollback
                    setItems(previousItems)
                    setStats(previousStats)
                    addNotification(result.error || "Failed to update item", "error")
                    return false
                }
            } else {
                // Create new - wait for server since we need the ID
                const result = await createInventoryItem(cafe.id, {
                    name: data.name!,
                    category: data.category!,
                    stock: data.stock ?? 0,
                    warningThreshold: data.warningThreshold ?? 5,
                    expiryDate: data.expiryDate || undefined,
                    link: data.link || undefined,
                })

                if (result.success && result.data) {
                    const newItem = result.data.item
                    const updatedItems = [newItem, ...items]
                    setItems(updatedItems)
                    setStats(calculateStats(updatedItems))
                    addNotification("Item created successfully", "success")
                    // Silently refresh
                    fetchData(true)
                    return true
                } else {
                    addNotification(result.error || "Failed to create item", "error")
                    return false
                }
            }
        } finally {
            setSavingItem(false)
        }
    }

    // Delete/Restore item
    const handleDelete = async (item: InventoryItem) => {
        // Save previous state
        const previousItems = [...items]
        const previousStats = stats
        
        if (item.status === "active") {
            if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return

            // Optimistic update
            const updatedItems = items.map((inventoryItem) =>
                inventoryItem.id === item.id ? { ...inventoryItem, status: "inactive" as const } : inventoryItem
            )
            setItems(updatedItems)
            setStats(calculateStats(updatedItems))

            const result = await softDeleteInventoryItem(item.id)
            if (result.success) {
                addNotification("Item deleted", "success")
                // Silently refresh
                fetchData(true)
            } else {
                // Rollback
                setItems(previousItems)
                setStats(previousStats)
                addNotification(result.error || "Failed to delete item", "error")
            }
        } else {
            // Optimistic update for restore
            const updatedItems = items.map((inventoryItem) =>
                inventoryItem.id === item.id ? { ...inventoryItem, status: "active" as const } : inventoryItem
            )
            setItems(updatedItems)
            setStats(calculateStats(updatedItems))
            
            const result = await restoreInventoryItem(item.id)
            if (result.success) {
                addNotification("Item restored", "success")
                // Silently refresh
                fetchData(true)
            } else {
                // Rollback
                setItems(previousItems)
                setStats(previousStats)
                addNotification(result.error || "Failed to restore item", "error")
            }
        }
    }

    // Permanently delete item
    const handlePermanentDelete = async (item: InventoryItem) => {
        if (!confirm(`WARNING: This will permanently delete "${item.name}" and all its history. This action cannot be undone.\n\nAre you absolutely sure?`)) return

        // Save previous state
        const previousItems = [...items]
        const previousStats = stats
        
        // Optimistic update
        const updatedItems = items.filter((inventoryItem) => inventoryItem.id !== item.id)
        setItems(updatedItems)
        setStats(calculateStats(updatedItems))

        const result = await deleteInventoryItem(item.id)
        if (result.success) {
            addNotification("Item permanently deleted", "success")
            // Silently refresh
            fetchData(true)
        } else {
            // Rollback
            setItems(previousItems)
            setStats(previousStats)
            addNotification(result.error || "Failed to permanently delete item", "error")
        }
    }

    // Adjust stock (quick adjustment without history)
    const handleAdjustStock = async (item: InventoryItem) => {
        const quantity = prompt(`Adjust stock for '${item.name}'\n\nCurrent: ${item.stock}\n\nEnter quantity to add (positive) or remove (negative):`)
        if (quantity === null) return

        const qty = parseInt(quantity)
        if (isNaN(qty) || qty === 0) {
            addNotification("Please enter a valid number", "error")
            return
        }

        // Save previous state
        const previousItems = [...items]
        const previousStats = stats
        
        const newStock = Math.max(0, item.stock + qty)
        
        // Optimistic update
        const updatedItems = items.map((inventoryItem) =>
            inventoryItem.id === item.id ? { ...inventoryItem, stock: newStock } : inventoryItem
        )
        setItems(updatedItems)
        setStats(calculateStats(updatedItems))

        const result = await adjustInventoryStock(item.id, { quantity: Math.abs(qty) })
        if (result.success && result.data) {
            addNotification(`Stock adjusted by ${qty > 0 ? "+" : ""}${qty}`, "success")
            // Silently refresh
            fetchData(true)
        } else {
            // Rollback
            setItems(previousItems)
            setStats(previousStats)
            addNotification(result.error || "Failed to adjust stock", "error")
        }
    }

    // Restock item
    const handleRestock = async (data: {
        quantity: number
        unitCost?: number
        totalAmount?: number
        invoiceNumber?: string
        orderReference?: string
        supplierName?: string
        proofUrl?: string
    }): Promise<boolean> => {
        if (!restockingItem) return false

        setSavingRestock(true)
        
        // Save previous state
        const previousItems = [...items]
        const previousStats = stats
        
        // Calculate new stock and cost price
        const newStock = restockingItem.stock + data.quantity
        const newCostPrice = data.unitCost ?? restockingItem.costPrice
        
        // Optimistic update
        const updatedItems = items.map((inventoryItem) =>
            inventoryItem.id === restockingItem.id 
                ? { ...inventoryItem, stock: newStock, costPrice: newCostPrice } 
                : inventoryItem
        )
        setItems(updatedItems)
        setStats(calculateStats(updatedItems))

        try {
            const result = await restockInventoryItem(restockingItem.id, {
                quantity: data.quantity,
                unitCost: data.unitCost ?? 0,
                totalAmount: data.totalAmount,
                proofUrl: data.proofUrl,
            })

            if (result.success && result.data) {
                addNotification(`Restocked ${data.quantity} units`, "success")
                // Silently refresh
                fetchData(true)
                return true
            } else {
                // Rollback
                setItems(previousItems)
                setStats(previousStats)
                addNotification(result.error || "Failed to restock", "error")
                return false
            }
        } finally {
            setSavingRestock(false)
        }
    }

    // Duplicate item
    const handleDuplicate = async (item: InventoryItem) => {
        const result = await createInventoryItem(cafe.id, {
            name: `${item.name} (Copy)`,
            category: item.category,
            stock: item.stock,
            warningThreshold: item.warningThreshold,
            expiryDate: item.expiryDate || undefined,
            link: item.link || undefined,
        })

        if (result.success && result.data) {
            const updatedItems = [result.data.item, ...items]
            setItems(updatedItems)
            setStats(calculateStats(updatedItems))
            addNotification("Item duplicated", "success")
            // Silently refresh
            fetchData(true)
        } else {
            addNotification(result.error || "Failed to duplicate item", "error")
        }
    }

    // View restock history
    const handleHistory = async (item: InventoryItem) => {
        setHistoryItem(item)
        setHistoryModalOpen(true)
        setHistoryLoading(true)

        const result = await getRestockHistory(item.id)
        if (result.success && result.data) {
            setHistoryData(result.data.history)
        } else {
            addNotification(result.error || "Failed to fetch history", "error")
        }

        setHistoryLoading(false)
    }

    // Export to CSV
    const handleExport = async () => {
        setExporting(true)
        const result = await exportInventoryToCSV(cafe.id, filters)
        if (result.success && result.data) {
            const blob = new Blob([result.data.csv], { type: "text/csv" })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = result.data.filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
            addNotification("CSV exported successfully", "success")
        } else {
            addNotification(result.error || "Failed to export CSV", "error")
        }
        setExporting(false)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Link
                        href="/owner"
                        className="inline-flex items-center gap-1 text-sm text-text/60 hover:text-text mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold">{cafe.name} - Inventory</h1>
                </div>
                <button
                    onClick={() => {
                        setEditingItem(null)
                        setItemModalOpen(true)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition"
                >
                    <Plus className="w-4 h-4" />
                    Add Item
                </button>
            </div>

            {/* Stats Cards */}
            <InventoryStatsCards stats={stats} loading={loading} />

            {/* Filters */}
            <InventoryFilters
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
                onExportCSV={handleExport}
                exporting={exporting}
            />

            {/* Table */}
            <InventoryTable
                items={items}
                loading={loading}
                onEdit={(item) => {
                    setEditingItem(item)
                    setItemModalOpen(true)
                }}
                onAdjustStock={handleAdjustStock}
                onRestock={(item) => {
                    setRestockingItem(item)
                    setRestockModalOpen(true)
                }}
                onDuplicate={handleDuplicate}
                onHistory={handleHistory}
                onDelete={handleDelete}
                onPermanentDelete={handlePermanentDelete}
            />

            {/* Modals */}
            <InventoryItemModal
                open={itemModalOpen}
                onClose={() => {
                    setItemModalOpen(false)
                    setEditingItem(null)
                }}
                onSave={handleSaveItem}
                editingItem={editingItem}
                categories={categories}
                saving={savingItem}
            />

            <InventoryRestockModal
                open={restockModalOpen}
                onClose={() => {
                    setRestockModalOpen(false)
                    setRestockingItem(null)
                }}
                onRestock={handleRestock}
                item={restockingItem}
                saving={savingRestock}
            />

            <InventoryHistoryModal
                open={historyModalOpen}
                onClose={() => {
                    setHistoryModalOpen(false)
                    setHistoryItem(null)
                    setHistoryData([])
                }}
                itemName={historyItem?.name ?? ""}
                history={historyData}
                loading={historyLoading}
            />
        </div>
    )
}
