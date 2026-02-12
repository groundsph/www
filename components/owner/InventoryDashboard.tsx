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

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [itemsResult, statsResult] = await Promise.all([
                getInventoryItems(cafe.id, filters),
                getInventoryStats(cafe.id),
            ])

            if (itemsResult.success && itemsResult.data) {
                setItems(itemsResult.data.items)
            } else {
                addNotification(itemsResult.error || "Failed to fetch items", "error")
            }

            if (statsResult.success && statsResult.data) {
                setStats(statsResult.data)
            }
        } catch (error) {
            console.error("[InventoryDashboard] Error fetching data:", error)
            addNotification("Failed to load inventory data", "error")
        } finally {
            setLoading(false)
        }
    }, [cafe.id, filters, addNotification])

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
        try {
            if (editingItem) {
                // Update existing
                const result = await updateInventoryItem(editingItem.id, {
                    name: data.name!,
                    category: data.category!,
                    stock: data.stock,
                    warningThreshold: data.warningThreshold,
                    expiryDate: data.expiryDate || undefined,
                    link: data.link || undefined,
                })

                if (result.success) {
                    setItems((prev) =>
                        prev.map((item) =>
                            item.id === editingItem.id
                                ? { ...item, ...data } as InventoryItem
                                : item
                        )
                    )
                    addNotification("Item updated successfully", "success")
                    return true
                } else {
                    addNotification(result.error || "Failed to update item", "error")
                    return false
                }
            } else {
                // Create new
                const result = await createInventoryItem(cafe.id, {
                    name: data.name!,
                    category: data.category!,
                    stock: data.stock ?? 0,
                    warningThreshold: data.warningThreshold ?? 5,
                    expiryDate: data.expiryDate || undefined,
                    link: data.link || undefined,
                })

                if (result.success && result.data) {
                    setItems((prev) => [result.data!.item, ...prev])
                    addNotification("Item created successfully", "success")
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
        if (item.status === "active") {
            if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return

            const result = await softDeleteInventoryItem(item.id)
            if (result.success) {
                setItems((prev) =>
                    prev.map((it) =>
                        it.id === item.id ? { ...it, status: "inactive" } : it
                    )
                )
                addNotification("Item deleted", "success")
            } else {
                addNotification(result.error || "Failed to delete item", "error")
            }
        } else {
            const result = await restoreInventoryItem(item.id)
            if (result.success) {
                setItems((prev) =>
                    prev.map((it) =>
                        it.id === item.id ? { ...it, status: "active" } : it
                    )
                )
                addNotification("Item restored", "success")
            } else {
                addNotification(result.error || "Failed to restore item", "error")
            }
        }
    }

    // Adjust stock (quick adjustment without history)
    const handleAdjustStock = async (item: InventoryItem) => {
        const quantity = prompt(`Adjust stock for &apos;${item.name}&apos;\n\nCurrent: ${item.stock}\n\nEnter quantity to add (positive) or remove (negative):`)
        if (quantity === null) return

        const qty = parseInt(quantity)
        if (isNaN(qty) || qty === 0) {
            addNotification("Please enter a valid number", "error")
            return
        }

        const result = await adjustInventoryStock(item.id, { quantity: Math.abs(qty) })
        if (result.success && result.data) {
            setItems((prev) =>
                prev.map((it) =>
                    it.id === item.id ? result.data!.item : it
                )
            )
            addNotification(`Stock adjusted by ${qty > 0 ? "+" : ""}${qty}`, "success")
        } else {
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
        try {
            const result = await restockInventoryItem(restockingItem.id, {
                quantity: data.quantity,
                unitCost: data.unitCost ?? 0,
                totalAmount: data.totalAmount,
                proofUrl: data.proofUrl,
            })

            if (result.success && result.data) {
                setItems((prev) =>
                    prev.map((it) =>
                        it.id === restockingItem!.id ? result.data!.item : it
                    )
                )
                addNotification(`Restocked ${data.quantity} units`, "success")
                return true
            } else {
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
            setItems((prev) => [result.data!.item, ...prev])
            addNotification("Item duplicated", "success")
        } else {
            addNotification(result.error || "Failed to duplicate item", "error")
        }
    }

    // View history
    const handleHistory = async (item: InventoryItem) => {
        setHistoryItem(item)
        setHistoryModalOpen(true)
        setHistoryLoading(true)

        try {
            const result = await getRestockHistory(item.id)
            if (result.success && result.data) {
                setHistoryData(result.data.history)
            } else {
                addNotification(result.error || "Failed to fetch history", "error")
            }
        } finally {
            setHistoryLoading(false)
        }
    }

    // Export CSV
    const handleExportCSV = async () => {
        setExporting(true)
        try {
            const result = await exportInventoryToCSV(cafe.id, filters)
            if (result.success && result.data) {
                // Download the CSV
                const blob = new Blob([result.data.csv], { type: "text/csv" })
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = result.data.filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                window.URL.revokeObjectURL(url)
                addNotification("CSV exported successfully", "success")
            } else {
                addNotification(result.error || "Failed to export CSV", "error")
            }
        } finally {
            setExporting(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Back Button */}
            <Link
                href={`/owner/cafes/${cafe.slug}`}
                className="inline-flex items-center gap-1 text-text/60 hover:text-text mb-4 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Cafe Management
            </Link>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Inventory</h1>
                    <p className="text-text/60">Manage your cafe&apos;s supplies and stock</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setEditingItem(null)
                            setItemModalOpen(true)
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Item
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <InventoryStatsCards stats={stats} loading={loading} />

            {/* Filters */}
            <InventoryFilters
                filters={filters}
                onFiltersChange={setFilters}
                categories={categories}
                onExportCSV={handleExportCSV}
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
                history={historyData}
                itemName={historyItem?.name || ""}
                loading={historyLoading}
            />
        </motion.div>
    )
}
