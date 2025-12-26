"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Store, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { submitCafeClaim } from "@/app/api/actions/claim"

interface ClaimCafeModalProps {
    isOpen: boolean
    onClose: () => void
    cafeId: string
    cafeName: string
}

export default function ClaimCafeModal({
    isOpen,
    onClose,
    cafeId,
    cafeName,
}: ClaimCafeModalProps) {
    const [proofText, setProofText] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
    } | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!proofText.trim()) return

        setIsSubmitting(true)
        setResult(null)

        try {
            const response = await submitCafeClaim(cafeId, proofText.trim())

            if (response.success) {
                setResult({
                    success: true,
                    message:
                        "Your claim has been submitted! We'll review it and get back to you soon.",
                })
                setProofText("")
            } else {
                setResult({
                    success: false,
                    message: response.error || "Failed to submit claim",
                })
            }
        } catch (error) {
            console.error("Error submitting claim:", error)
            setResult({
                success: false,
                message: "An unexpected error occurred",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        if (!isSubmitting) {
            setProofText("")
            setResult(null)
            onClose()
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50'
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className='fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full bg-background rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]'
                    >
                        {/* Header */}
                        <div className='flex items-center justify-between p-4 border-b border-text/10'>
                            <div className='flex items-center gap-3'>
                                <div className='w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center'>
                                    <Store className='w-5 h-5 text-primary' />
                                </div>
                                <div>
                                    <h2 className='font-semibold text-lg'>
                                        Claim this Cafe
                                    </h2>
                                    <p className='text-sm text-text/60'>
                                        {cafeName}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className='p-2 rounded-lg hover:bg-text/10 transition-colors disabled:opacity-50 cursor-pointer'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        {/* Content */}
                        <div className='flex-1 overflow-y-auto p-4'>
                            {result?.success ? (
                                <div className='flex flex-col items-center text-center py-8'>
                                    <div className='w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4'>
                                        <CheckCircle className='w-8 h-8 text-green-500' />
                                    </div>
                                    <h3 className='text-xl font-semibold mb-2'>
                                        Claim Submitted!
                                    </h3>
                                    <p className='text-text/60 max-w-sm mb-6'>
                                        {result.message}
                                    </p>
                                    <button
                                        onClick={handleClose}
                                        className='px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors'
                                    >
                                        Done
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit}>
                                    <div className='mb-4'>
                                        <p className='text-text/70 mb-4'>
                                            To claim ownership of this cafe,
                                            please provide proof that you are
                                            the owner or an authorized
                                            representative.
                                        </p>

                                        <label className='block text-sm font-medium mb-2'>
                                            Proof of Ownership{" "}
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        </label>
                                        <textarea
                                            value={proofText}
                                            onChange={(e) =>
                                                setProofText(e.target.value)
                                            }
                                            placeholder="Examples:&#10;• I'm the owner, my name is [Name] and I can verify via business registration&#10;• I'm the manager, you can contact the cafe at [phone/email]&#10;• Our business permit number is [XXX]"
                                            className='w-full h-40 p-3 bg-text/5 border border-text/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm'
                                            required
                                            disabled={isSubmitting}
                                        />
                                        <p className='text-xs text-text/50 mt-1'>
                                            We may contact you for verification
                                            before approving your claim.
                                        </p>
                                    </div>

                                    {result && !result.success && (
                                        <div className='flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4'>
                                            <AlertCircle className='w-5 h-5 text-red-500 shrink-0 mt-0.5' />
                                            <p className='text-sm text-red-600'>
                                                {result.message}
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        type='submit'
                                        disabled={
                                            isSubmitting || !proofText.trim()
                                        }
                                        className='w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className='w-4 h-4 animate-spin' />
                                                Submitting...
                                            </>
                                        ) : (
                                            "Submit Claim"
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
