"use client"

import { useState } from "react"
import { X, AlertTriangle, Loader2 } from "lucide-react"

interface RejectPostModalProps {
    postTitle: string
    postId: string
    onClose: () => void
    onConfirm: (reason: string) => Promise<void>
    isProcessing: boolean
}

export default function RejectPostModal({
    postTitle,
    onClose,
    onConfirm,
    isProcessing,
}: RejectPostModalProps) {
    const [reason, setReason] = useState("")
    const [error, setError] = useState<string | null>(null)

    const minLength = 5
    const isValid = reason.trim().length >= minLength

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!isValid) {
            setError(`Rejection reason must be at least ${minLength} characters`)
            return
        }

        try {
            await onConfirm(reason.trim())
        } catch {
            setError("Failed to reject post. Please try again.")
        }
    }

    const handleClose = () => {
        if (isProcessing) return
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-background rounded-2xl shadow-xl ring-1 ring-text/10 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                <form onSubmit={handleSubmit} className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-text">
                                    Reject Post
                                </h3>
                                <p className="text-xs text-text/60 truncate max-w-[200px]">
                                    {postTitle}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-2 text-text/40 hover:text-text hover:bg-text/5 rounded-lg transition-colors cursor-pointer"
                            disabled={isProcessing}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Content */}
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="rejection-reason"
                                className="block text-sm font-medium text-text/80 mb-2"
                            >
                                Rejection Reason
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <textarea
                                id="rejection-reason"
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value)
                                    setError(null)
                                }}
                                rows={4}
                                className="w-full px-3 py-2 bg-tertiary/10 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-text resize-none"
                                placeholder="Explain why this post is being rejected..."
                                disabled={isProcessing}
                                autoFocus
                            />
                            <p className="text-xs text-text/50 mt-1">
                                Minimum {minLength} characters required
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-text/60 hover:text-text hover:bg-text/5 rounded-xl transition-colors cursor-pointer"
                            disabled={isProcessing}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || isProcessing}
                            className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Rejecting...
                                </>
                            ) : (
                                "Reject Post"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
