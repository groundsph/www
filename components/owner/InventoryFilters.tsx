"use client"

import { useState } from "react"
import { Search, Download, AlertCircle, ChevronDown, X } from "lucide-react"

export interface InventoryFiltersState {
    search: string
    category: string
    lowStockOnly: boolean
    status: "active" | "inactive" | "all"
}

interface InventoryFiltersProps {
    filters: InventoryFiltersState
    onFiltersChange: (filters: InventoryFiltersState) => void
    categories: string[]
    onExportCSV: () => void
    exporting?: boolean
}

export default function InventoryFilters({
    filters,
    onFiltersChange,
    categories,
    onExportCSV,
    exporting = false,
}: InventoryFiltersProps) {
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
    const [showAddCategory, setShowAddCategory] = useState(false)
    const [newCategory, setNewCategory] = useState("")

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onFiltersChange({ ...filters, search: e.target.value })
    }

    const handleCategorySelect = (category: string) => {
        onFiltersChange({ ...filters, category })
        setShowCategoryDropdown(false)
        setShowAddCategory(false)
    }

    const handleAddNewCategory = () => {
        if (newCategory.trim()) {
            onFiltersChange({ ...filters, category: newCategory.trim() })
            setNewCategory("")
            setShowCategoryDropdown(false)
            setShowAddCategory(false)
        }
    }

    const handleLowStockToggle = () => {
        onFiltersChange({ ...filters, lowStockOnly: !filters.lowStockOnly })
    }

    const handleStatusChange = (status: "active" | "inactive" | "all") => {
        onFiltersChange({ ...filters, status })
    }

    const clearFilters = () => {
        onFiltersChange({
            search: "",
            category: "",
            lowStockOnly: false,
            status: "all",
        })
    }

    const hasActiveFilters = filters.search || filters.category || filters.lowStockOnly || filters.status !== "all"

    return (
        <div className="space-y-4">
            {/* Search and Category Row */}
            <div className="flex flex-col md:flex-row gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={handleSearchChange}
                        placeholder="Search items..."
                        className="w-full pl-10 pr-4 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                {/* Category Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        className="flex items-center gap-2 px-4 py-2 bg-text/5 border border-text/10 rounded-lg hover:bg-text/10 transition-colors min-w-[140px]"
                    >
                        <span className={filters.category ? "text-text" : "text-text/60"}>
                            {filters.category || "All Categories"}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`} />
                    </button>

                    {showCategoryDropdown && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => {
                                    setShowCategoryDropdown(false)
                                    setShowAddCategory(false)
                                }}
                            />
                            <div className="absolute top-full mt-1 right-0 w-56 bg-background border border-text/10 rounded-lg shadow-lg z-50 py-1">
                                <button
                                    onClick={() => handleCategorySelect("")}
                                    className={`w-full px-4 py-2 text-left hover:bg-text/5 transition-colors ${!filters.category ? "bg-primary/10 text-primary" : ""}`}
                                >
                                    All Categories
                                </button>
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => handleCategorySelect(cat)}
                                        className={`w-full px-4 py-2 text-left hover:bg-text/5 transition-colors ${filters.category === cat ? "bg-primary/10 text-primary" : ""}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                                <div className="border-t border-text/10 my-1" />
                                {showAddCategory ? (
                                    <div className="px-3 py-2 space-y-2">
                                        <input
                                            type="text"
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                            placeholder="New category name"
                                            className="w-full px-3 py-1.5 bg-text/5 border border-text/10 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleAddNewCategory()
                                                if (e.key === "Escape") {
                                                    setShowAddCategory(false)
                                                    setNewCategory("")
                                                }
                                            }}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleAddNewCategory}
                                                disabled={!newCategory.trim()}
                                                className="flex-1 px-3 py-1 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                                            >
                                                Add
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowAddCategory(false)
                                                    setNewCategory("")
                                                }}
                                                className="px-3 py-1 bg-text/10 rounded text-sm hover:bg-text/20"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowAddCategory(true)}
                                        className="w-full px-4 py-2 text-left text-primary hover:bg-primary/10 transition-colors text-sm"
                                    >
                                        + Add New Category
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Low Stock Toggle */}
                <button
                    onClick={handleLowStockToggle}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        filters.lowStockOnly
                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                            : "bg-text/5 border border-text/10 hover:bg-text/10"
                    }`}
                >
                    <AlertCircle className="w-4 h-4" />
                    Low Stock Only
                </button>

                {/* Export CSV */}
                <button
                    onClick={onExportCSV}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 bg-text/5 border border-text/10 rounded-lg hover:bg-text/10 transition-colors disabled:opacity-50"
                >
                    <Download className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} />
                    {exporting ? "Exporting..." : "Export CSV"}
                </button>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-3 py-2 text-text/60 hover:text-text transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Clear
                    </button>
                )}
            </div>

            {/* Status Tabs */}
            <div className="flex gap-1 border-b border-text/10">
                {[
                    { id: "all" as const, label: "All" },
                    { id: "active" as const, label: "Active" },
                    { id: "inactive" as const, label: "Inactive" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => handleStatusChange(tab.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            filters.status === tab.id
                                ? "border-primary text-primary"
                                : "border-transparent text-text/60 hover:text-text hover:border-text/20"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
