"use client"

import { InventoryStats } from "@/utils/types/inventory"
import { motion } from "motion/react"
import { Package, AlertTriangle, Calculator } from "lucide-react"

interface InventoryStatsCardsProps {
    stats: InventoryStats | null
    loading?: boolean
}

export default function InventoryStatsCards({ stats, loading }: InventoryStatsCardsProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 bg-text/5 rounded-xl border border-text/10 animate-pulse">
                        <div className="h-10 bg-text/10 rounded-lg"></div>
                    </div>
                ))}
            </div>
        )
    }

    const cards = [
        {
            label: "Total Items",
            value: stats?.totalItems ?? 0,
            icon: Package,
            color: "bg-blue-100 text-blue-700",
            alert: false,
        },
        {
            label: "Low Stock",
            value: stats?.lowStockCount ?? 0,
            icon: AlertTriangle,
            color: stats && stats.lowStockCount > 0
                ? "bg-amber-100 text-amber-700"
                : "bg-green-100 text-green-700",
            alert: stats ? stats.lowStockCount > 0 : false,
        },
        {
            label: "Inventory Valuation",
            value: stats ? `₱${stats.valuation.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₱0.00",
            icon: Calculator,
            color: "bg-purple-100 text-purple-700",
            alert: false,
        },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 bg-background border border-text/10 rounded-xl hover:border-primary/30 transition-all shadow-sm ${card.alert ? "border-amber-300 ring-1 ring-amber-200" : ""}`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${card.color}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium text-text/60">
                                {card.label}
                            </span>
                        </div>
                        <div className={`text-2xl font-bold ${card.alert ? "text-amber-600" : ""}`}>
                            {card.value}
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}
