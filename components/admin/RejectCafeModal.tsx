"use client"

import { useState } from "react"
import { X, AlertTriangle, Loader2 } from "lucide-react"

interface RejectCafeModalProps {
    isOpen: boolean
    onClose: () => void
    cafeName: string
    onConfirm: (reason?: string) => Promise<void>
}

const REJECTION_REASONS = [
    { value: "", label: "Select a reason (optional)" },
    { value: "duplicate", label: "Duplicate entry" },
    { value: "not_cafe", label: "Not a cafe" },
    { value: "insufficient_info", label: "Insufficient information" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "other", label: "Other" },
] as const

export default function RejectCafeModal({
    isOpen,
    onClose,
    cafeName,
    onConfirm,
}: RejectCafeModalProps) {
    const [selectedReason, setSelectedReason] = useState("")
    const [additionalDetails, setAdditionalDetails] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isOpen) return null

    const handleConfirm = async () => {
        setIsSubmitting(true)

        // Build the reason string
        let reason: string | undefined
        const reasonLabel = REJECTION_REASONS.find(
            (r) => r.value === selectedReason
        )?.label

        if (selectedReason && selectedReason !== "") {
            reason =
                reasonLabel !== "Select a reason (optional)"
                    ? reasonLabel
                    : undefined
            if (additionalDetails.trim()) {
                reason = reason
                    ? `${reason}: ${additionalDetails.trim()}`
                    : additionalDetails.trim()
            }
        } else if (additionalDetails.trim()) {
            reason = additionalDetails.trim()
        }

        try {
            await onConfirm(reason)
            // Reset state
            setSelectedReason("")
            setAdditionalDetails("")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        if (isSubmitting) return
        setSelectedReason("")
        setAdditionalDetails("")
        onClose()
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            {/* Backdrop */}
            <div
                className='absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'
                onClick={handleClose}
            />

            {/* Modal */}
            <div className='relative w-full max-w-md bg-background rounded-2xl shadow-xl ring-1 ring-text/10 overflow-hidden animate-in zoom-in-95 fade-in duration-200'>
                <div className='p-6'>
                    {/* Header */}
                    <div className='flex items-center justify-between mb-6'>
                        <div className='flex items-center gap-3'>
                            <div className='w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500'>
                                <AlertTriangle className='w-5 h-5' />
                            </div>
                            <div>
                                <h3 className='text-lg font-semibold text-text'>
                                    Reject Cafe
                                </h3>
                                <p className='text-xs text-text/60 truncate max-w-[200px]'>
                                    {cafeName}
                                </p>
                            </div>
                        </div>
                        <button
                            type='button'
                            onClick={handleClose}
                            className='p-2 text-text/40 hover:text-text hover:bg-text/5 rounded-lg transition-colors cursor-pointer'
                            disabled={isSubmitting}
                        >
                            <X className='w-5 h-5' />
                        </button>
                    </div>

                    {/* Content */}
                    <div className='space-y-4'>
                        <p className='text-sm text-text/70'>
                            Are you sure you want to reject and delete this cafe
                            submission? This action cannot be undone.
                        </p>

                        {/* Predefined Reasons */}
                        <div className='space-y-2'>
                            <label className='text-sm font-medium text-text/80'>
                                Reason
                                <span className='text-text/40 font-normal ml-1'>
                                    (Optional)
                                </span>
                            </label>
                            <select
                                value={selectedReason}
                                onChange={(e) =>
                                    setSelectedReason(e.target.value)
                                }
                                className='w-full px-3 py-2 bg-tertiary/10 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 text-text sm:text-sm cursor-pointer'
                                disabled={isSubmitting}
                            >
                                {REJECTION_REASONS.map((r) => (
                                    <option
                                        key={r.value}
                                        value={r.value}
                                    >
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Additional Details */}
                        <div className='space-y-2'>
                            <label className='text-sm font-medium text-text/80'>
                                Additional Details
                                <span className='text-text/40 font-normal ml-1'>
                                    (Optional)
                                </span>
                            </label>
                            <textarea
                                value={additionalDetails}
                                onChange={(e) =>
                                    setAdditionalDetails(e.target.value)
                                }
                                rows={3}
                                className='w-full px-3 py-2 bg-tertiary/10 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 text-text sm:text-sm resize-none'
                                placeholder='Provide more context for the contributor...'
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className='mt-6 flex gap-3'>
                        <button
                            type='button'
                            onClick={handleClose}
                            className='flex-1 px-4 py-2 text-sm font-medium text-text/60 hover:text-text hover:bg-text/5 rounded-xl transition-colors cursor-pointer'
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type='button'
                            onClick={handleConfirm}
                            disabled={isSubmitting}
                            className='flex-1 px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                    Rejecting...
                                </>
                            ) : (
                                "Reject Cafe"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
