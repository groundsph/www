"use client"

import { InventoryRestockHistory } from "@/utils/types/inventory"
import { X, Package, Calendar, Receipt, Building2, FileText, ExternalLink, ArrowUpRight } from "lucide-react"

interface InventoryHistoryModalProps {
    open: boolean
    onClose: () => void
    history: InventoryRestockHistory[]
    itemName: string
    loading?: boolean
}

export default function InventoryHistoryModal({
    open,
    onClose,
    history,
    itemName,
    loading,
}: InventoryHistoryModalProps) {
    if (!open) return null

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-background rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold">Restock History</h2>
                        <p className="text-sm text-text/60">{itemName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-text/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-4 bg-text/5 rounded-xl animate-pulse">
                                <div className="h-16 bg-text/10 rounded-lg"></div>
                            </div>
                        ))}
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-12 bg-text/5 rounded-xl">
                        <Package className="w-12 h-12 text-text/30 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-text/60">No restock history</h3>
                        <p className="text-sm text-text/40 mt-1">
                            This item has no restock records yet
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((entry) => (
                            <div
                                key={entry.id}
                                className="p-4 bg-text/5 rounded-xl border border-text/10 hover:border-text/20 transition-colors"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Package className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">
                                                +{entry.quantity} units added
                                            </p>
                                            <div className="flex items-center gap-2 text-sm text-text/60 mt-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(entry.date).toLocaleDateString("en-PH", {
                                                    year: "numeric",
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                                <span className="text-text/30">•</span>
                                                {new Date(entry.date).toLocaleTimeString("en-PH", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className="font-bold text-lg">
                                            {entry.totalAmount
                                                ? `₱${entry.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : "—"}
                                        </p>
                                        {entry.unitCost && (
                                            <p className="text-sm text-text/60">
                                                @ ₱{entry.unitCost.toFixed(2)} / unit
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Additional Details */}
                                {(entry.invoiceNumber || entry.orderReference || entry.supplierName || entry.proofUrl) && (
                                    <div className="mt-3 pt-3 border-t border-text/10 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {entry.invoiceNumber && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Receipt className="w-3.5 h-3.5 text-text opacity-40" />
                                                <span className="text-text/60">Invoice:</span>
                                                <span className="font-medium">{entry.invoiceNumber}</span>
                                            </div>
                                        )}
                                        {entry.orderReference && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <FileText className="w-3.5 h-3.5 text-text opacity-40" />
                                                <span className="text-text/60">Order Ref:</span>
                                                <span className="font-medium">{entry.orderReference}</span>
                                            </div>
                                        )}
                                        {entry.supplierName && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Building2 className="w-3.5 h-3.5 text-text/40" />
                                                <span className="text-text/60">Supplier:</span>
                                                <span className="font-medium">{entry.supplierName}</span>
                                            </div>
                                        )}
                                        {entry.proofUrl && (
                                            <a
                                                href={entry.proofUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                View Proof
                                                <ArrowUpRight className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-text/10 rounded-lg font-medium hover:bg-text/20 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
