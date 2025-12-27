"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
    X,
    Store,
    Loader2,
    CheckCircle,
    AlertCircle,
    Upload,
    FileText,
    Trash2,
} from "lucide-react"
import { submitCafeClaim } from "@/app/api/actions/claim"
import { uploadOwnershipProofWithProgress } from "@/utils/supabase/storage-client"

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
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!proofText.trim() && !proofFile) {
            setResult({
                success: false,
                message:
                    "Please provide either a description or a proof document",
            })
            return
        }

        setIsSubmitting(true)
        setResult(null)
        setUploadProgress(0)

        try {
            let proofUrl: string | undefined

            // Upload proof file if present
            if (proofFile) {
                const uploadResult = await uploadOwnershipProofWithProgress(
                    proofFile,
                    (progress) => setUploadProgress(progress)
                )

                if (!uploadResult.success || !uploadResult.url) {
                    throw new Error(
                        uploadResult.error || "Failed to upload proof document"
                    )
                }

                proofUrl = uploadResult.url
            }

            const response = await submitCafeClaim(
                cafeId,
                proofText.trim() || "Document attached",
                proofUrl
            )

            if (response.success) {
                setResult({
                    success: true,
                    message:
                        "Your claim has been submitted! We'll review it and get back to you soon.",
                })
                setProofText("")
                setProofFile(null)
                setUploadProgress(0)
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
                message:
                    error instanceof Error
                        ? error.message
                        : "An unexpected error occurred",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        if (!isSubmitting) {
            setProofText("")
            setProofFile(null)
            setUploadProgress(0)
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
                                        <div className='mb-4'>
                                            <label className='block text-sm font-medium mb-2'>
                                                Proof Document (Optional but
                                                Recommended)
                                            </label>

                                            {!proofFile ? (
                                                <div className='border-2 border-dashed border-text/20 rounded-xl p-4 text-center hover:border-primary/50 transition-colors bg-text/5'>
                                                    <input
                                                        type='file'
                                                        id='modal-proof-upload'
                                                        accept='image/jpeg,image/png,image/webp,application/pdf'
                                                        className='hidden'
                                                        onChange={(e) => {
                                                            const file =
                                                                e.target
                                                                    .files?.[0]
                                                            if (file)
                                                                setProofFile(
                                                                    file
                                                                )
                                                            e.target.value = ""
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor='modal-proof-upload'
                                                        className='cursor-pointer flex flex-col items-center justify-center'
                                                    >
                                                        <Upload className='w-6 h-6 text-text/40 mb-2' />
                                                        <span className='text-sm font-medium text-text/70'>
                                                            Upload Business
                                                            Permit / ID
                                                        </span>
                                                        <span className='text-xs text-text/50 mt-1'>
                                                            Max 10MB (PDF, JPG,
                                                            PNG)
                                                        </span>
                                                    </label>
                                                </div>
                                            ) : (
                                                <div className='bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3'>
                                                    <FileText className='w-4 h-4 text-primary shrink-0' />
                                                    <div className='flex-1 overflow-hidden'>
                                                        <p className='text-sm font-medium text-text/80 truncate'>
                                                            {proofFile.name}
                                                        </p>
                                                        <p className='text-xs text-text/50'>
                                                            {(
                                                                proofFile.size /
                                                                1024
                                                            ).toFixed(0)}{" "}
                                                            KB
                                                        </p>
                                                        {uploadProgress > 0 &&
                                                            uploadProgress <
                                                                100 && (
                                                                <div className='w-full h-1 bg-text/10 rounded-full mt-1.5 overflow-hidden'>
                                                                    <div
                                                                        className='h-full bg-primary transition-all duration-300'
                                                                        style={{
                                                                            width: `${uploadProgress}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                    </div>
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            setProofFile(null)
                                                        }
                                                        className='p-1.5 hover:bg-red-100 rounded-lg text-text/40 hover:text-red-500 transition-colors'
                                                    >
                                                        <Trash2 className='w-4 h-4' />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

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
