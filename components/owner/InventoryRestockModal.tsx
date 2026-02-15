"use client"

import { useState, useEffect } from "react"
import { InventoryItem } from "@/utils/types/inventory"
import {
    X,
    Loader2,
    Calculator,
    Receipt,
    Building2,
    FileText,
    Link2,
} from "lucide-react"

interface InventoryRestockModalProps {
    open: boolean
    onClose: () => void
    onRestock: (data: {
        quantity: number
        unitCost?: number
        totalAmount?: number
        invoiceNumber?: string
        orderReference?: string
        supplierName?: string
        proofUrl?: string
    }) => Promise<boolean>
    item: InventoryItem | null
    saving?: boolean
}

export default function InventoryRestockModal({
    open,
    onClose,
    onRestock,
    item,
    saving = false,
}: InventoryRestockModalProps) {
    const [quantity, setQuantity] = useState(1)
    const [unitCost, setUnitCost] = useState("")
    const [invoiceNumber, setInvoiceNumber] = useState("")
    const [orderReference, setOrderReference] = useState("")
    const [supplierName, setSupplierName] = useState("")
    const [proofUrl, setProofUrl] = useState("")
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Calculate total
    const totalAmount =
        quantity > 0 && unitCost ? quantity * parseFloat(unitCost) : 0

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (open && item) {
            setQuantity(1)
            setUnitCost(item.costPrice?.toString() ?? "")
            setInvoiceNumber("")
            setOrderReference("")
            setSupplierName("")
            setProofUrl("")
            setErrors({})
        }
    }, [open, item])
    /* eslint-enable react-hooks/set-state-in-effect */

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {}

        if (!quantity || quantity < 1) {
            newErrors.quantity = "Quantity must be at least 1"
        }

        if (unitCost) {
            const cost = parseFloat(unitCost)
            if (isNaN(cost) || cost < 0) {
                newErrors.unitCost = "Unit cost must be 0 or greater"
            }
        }

        if (proofUrl) {
            try {
                new URL(proofUrl)
            } catch {
                newErrors.proofUrl = "Must be a valid URL"
            }
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) return

        const success = await onRestock({
            quantity,
            unitCost: unitCost ? parseFloat(unitCost) : undefined,
            totalAmount: totalAmount > 0 ? totalAmount : undefined,
            invoiceNumber: invoiceNumber || undefined,
            orderReference: orderReference || undefined,
            supplierName: supplierName || undefined,
            proofUrl: proofUrl || undefined,
        })

        if (success) {
            onClose()
        }
    }

    if (!open || !item) return null

    return (
        <div
            className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
            onClick={onClose}
        >
            <div
                className='bg-background rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto'
                onClick={(e) => e.stopPropagation()}
            >
                <div className='flex items-center justify-between mb-6'>
                    <h2 className='text-xl font-semibold'>Restock Item</h2>
                    <button
                        onClick={onClose}
                        className='p-2 hover:bg-text/10 rounded-lg transition-colors'
                    >
                        <X className='w-5 h-5' />
                    </button>
                </div>

                {/* Item Info */}
                <div className='p-4 bg-text/5 rounded-xl mb-6'>
                    <p className='font-medium'>{item.name}</p>
                    <p className='text-sm text-text/60'>{item.category}</p>
                    <div className='flex items-center gap-4 mt-2 text-sm'>
                        <span className='text-text/60'>
                            Current Stock:{" "}
                            <span className='font-medium text-text'>
                                {item.stock}
                            </span>
                        </span>
                        {item.costPrice && (
                            <span className='text-text/60'>
                                Last Cost:{" "}
                                <span className='font-medium text-text'>
                                    ₱{item.costPrice.toFixed(2)}
                                </span>
                            </span>
                        )}
                    </div>
                </div>

                <div className='space-y-4'>
                    {/* Quantity */}
                    <div>
                        <label className='block text-sm font-medium mb-1'>
                            Quantity to Add *
                        </label>
                        <input
                            type='number'
                            min='1'
                            value={quantity}
                            onChange={(e) =>
                                setQuantity(parseInt(e.target.value) || 0)
                            }
                            className={`w-full px-3 py-2 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                errors.quantity
                                    ? "border-red-300"
                                    : "border-text/10"
                            }`}
                        />
                        {errors.quantity && (
                            <p className='text-sm text-red-500 mt-1'>
                                {errors.quantity}
                            </p>
                        )}
                    </div>

                    {/* Unit Cost */}
                    <div>
                        <label className='text-sm font-medium mb-1 flex items-center gap-1'>
                            <Calculator className='w-3.5 h-3.5 text-text opacity-40' />
                            Unit Cost (₱)
                        </label>
                        <input
                            type='number'
                            min='0'
                            step='0.01'
                            value={unitCost}
                            onChange={(e) => setUnitCost(e.target.value)}
                            className={`w-full px-3 py-2 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                errors.unitCost
                                    ? "border-red-300"
                                    : "border-text/10"
                            }`}
                            placeholder='0.00'
                        />
                        {errors.unitCost && (
                            <p className='text-sm text-red-500 mt-1'>
                                {errors.unitCost}
                            </p>
                        )}
                    </div>

                    {/* Total Amount (Auto-calculated) */}
                    <div className='p-3 bg-primary/5 border border-primary/20 rounded-lg'>
                        <div className='flex items-center justify-between'>
                            <span className='text-sm font-medium'>
                                Total Amount:
                            </span>
                            <span className='text-lg font-bold text-primary'>
                                ₱
                                {totalAmount.toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                        </div>
                    </div>

                    <hr className='border-text/10' />

                    {/* Optional Fields */}
                    <p className='text-sm font-medium text-text/60'>
                        Optional Details
                    </p>

                    {/* Invoice Number */}
                    <div>
                        <label className='text-sm font-medium mb-1 flex items-center gap-1'>
                            <Receipt className='w-3.5 h-3.5 text-text opacity-40' />
                            Invoice Number
                        </label>
                        <input
                            type='text'
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className='w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                            placeholder='e.g., INV-2024-001'
                        />
                    </div>

                    {/* Order Reference */}
                    <div>
                        <label className='text-sm font-medium mb-1 flex items-center gap-1'>
                            <FileText className='w-3.5 h-3.5 text-text opacity-40' />
                            Order Reference
                        </label>
                        <input
                            type='text'
                            value={orderReference}
                            onChange={(e) => setOrderReference(e.target.value)}
                            className='w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                            placeholder='e.g., PO-12345'
                        />
                    </div>

                    {/* Supplier Name */}
                    <div>
                        <label className='text-sm font-medium mb-1 flex items-center gap-1'>
                            <Building2 className='w-3.5 h-3.5 text-text opacity-40' />
                            Supplier Name
                        </label>
                        <input
                            type='text'
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            className='w-full px-3 py-2 bg-text/5 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                            placeholder='e.g., Coffee Supplies Inc.'
                        />
                    </div>

                    {/* Proof URL */}
                    <div>
                        <label className='text-sm font-medium mb-1 flex items-center gap-1'>
                            <Link2 className='w-3.5 h-3.5 text-text opacity-40' />
                            Proof URL (Receipt/Photo)
                        </label>
                        <input
                            type='url'
                            value={proofUrl}
                            onChange={(e) => setProofUrl(e.target.value)}
                            className={`w-full px-3 py-2 bg-text/5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                errors.proofUrl
                                    ? "border-red-300"
                                    : "border-text/10"
                            }`}
                            placeholder='https://...'
                        />
                        {errors.proofUrl && (
                            <p className='text-sm text-red-500 mt-1'>
                                {errors.proofUrl}
                            </p>
                        )}
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
                        disabled={saving || quantity < 1}
                        className='flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2'
                    >
                        {saving && <Loader2 className='w-4 h-4 animate-spin' />}
                        {saving ? "Restocking..." : "Confirm Restock"}
                    </button>
                </div>
            </div>
        </div>
    )
}
