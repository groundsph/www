"use client"

import { useState } from "react"
import { X, AlertTriangle, Loader2 } from "lucide-react"

const SUGGESTED_REASONS = [
    "The document does not show the requester as owner",
    "The document is expired or unreadable",
    "The email address is not on the cafe's domain",
    "The social account could not be confirmed as official",
    "Not enough proof was provided",
] as const

interface RejectVerificationModalProps {
    cafeName: string
    onClose: () => void
    onConfirm: (reason: string) => Promise<void>
    isProcessing: boolean
}

export default function RejectVerificationModal({
    cafeName,
    onClose,
    onConfirm,
    isProcessing,
}: RejectVerificationModalProps) {
    const [reason, setReason] = useState("")
    const [error, setError] = useState<string | null>(null)

    const trimmedReason = reason.trim()
    const isValid = trimmedReason.length > 0

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)

        if (!isValid) {
            setError("A rejection reason is required — the owner sees it.")
            return
        }

        try {
            await onConfirm(trimmedReason)
        } catch {
            setError("Failed to reject this request. Please try again.")
        }
    }

    const handleClose = () => {
        if (isProcessing) return
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
            <div className='relative w-full max-w-md bg-background rounded-xl shadow-xl ring-1 ring-text/10 overflow-hidden animate-in zoom-in-95 fade-in duration-200'>
                <form
                    onSubmit={handleSubmit}
                    className='p-6'
                >
                    {/* Header */}
                    <div className='flex items-center justify-between mb-6'>
                        <div className='flex items-center gap-3'>
                            <div className='w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600'>
                                <AlertTriangle className='w-5 h-5' />
                            </div>
                            <div>
                                <h3 className='font-serif text-lg font-semibold text-text'>
                                    Reject ownership request
                                </h3>
                                <p className='text-xs text-text/60 truncate max-w-[200px]'>
                                    {cafeName}
                                </p>
                            </div>
                        </div>
                        <button
                            type='button'
                            onClick={handleClose}
                            className='p-2 text-text/40 hover:text-text hover:bg-text/5 rounded-lg transition-colors'
                            disabled={isProcessing}
                            aria-label='Close'
                        >
                            <X className='w-5 h-5' />
                        </button>
                    </div>

                    {/* Content */}
                    <div className='space-y-4'>
                        <p className='text-sm text-text/70'>
                            Ownership will not be granted. The requester sees
                            your reason on their cafe page and can send a new
                            request with different proof.
                        </p>

                        {/* Suggested reasons */}
                        <div className='flex flex-wrap gap-2'>
                            {SUGGESTED_REASONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type='button'
                                    onClick={() => {
                                        setReason(suggestion)
                                        setError(null)
                                    }}
                                    disabled={isProcessing}
                                    className='rounded-full border border-text/10 bg-tertiary/40 px-3 py-1 text-xs text-text/70 hover:bg-tertiary transition-colors disabled:opacity-50'
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>

                        <div className='space-y-2'>
                            <label
                                htmlFor='rejection-reason'
                                className='text-sm font-medium text-text/80'
                            >
                                Reason
                                <span className='text-text/40 font-normal ml-1'>
                                    (required)
                                </span>
                            </label>
                            <textarea
                                id='rejection-reason'
                                value={reason}
                                onChange={(event) => {
                                    setReason(event.target.value)
                                    setError(null)
                                }}
                                rows={3}
                                className='w-full px-3 py-2 bg-tertiary/10 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 text-text text-sm resize-none'
                                placeholder='Explain what was missing or wrong with the proof…'
                                disabled={isProcessing}
                            />
                        </div>

                        {error && (
                            <p
                                role='alert'
                                className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-text'
                            >
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className='mt-6 flex gap-3'>
                        <button
                            type='button'
                            onClick={handleClose}
                            className='flex-1 rounded-lg px-4 py-2 text-sm font-medium text-text/60 hover:text-text hover:bg-text/5 transition-colors'
                            disabled={isProcessing}
                        >
                            Cancel
                        </button>
                        <button
                            type='submit'
                            disabled={isProcessing}
                            className='flex-1 rounded-lg px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                    Rejecting…
                                </>
                            ) : (
                                "Reject request"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
