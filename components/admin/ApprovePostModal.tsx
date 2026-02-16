"use client"

import { useState } from "react"
import { X, CheckCircle, Loader2 } from "lucide-react"

interface ApprovePostModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<void>
    postTitle: string
}

export default function ApprovePostModal({
    isOpen,
    onClose,
    onConfirm,
    postTitle,
}: ApprovePostModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isOpen) return null

    const handleConfirm = async () => {
        setIsSubmitting(true)
        try {
            await onConfirm()
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        if (isSubmitting) return
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
                            <div className='w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600'>
                                <CheckCircle className='w-5 h-5' />
                            </div>
                            <div>
                                <h3 className='text-lg font-semibold text-text'>
                                    Approve Blog Post
                                </h3>
                                <p className='text-xs text-text/60 truncate max-w-[200px]'>
                                    {postTitle}
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
                    <p className='text-sm text-text/70 mb-6'>
                        Are you sure you want to approve this blog post? It will
                        be published and visible to all users.
                    </p>

                    {/* Actions */}
                    <div className='flex gap-3'>
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
                            className='flex-1 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                    Approving...
                                </>
                            ) : (
                                "Approve Post"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
