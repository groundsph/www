"use client"

import { useState } from "react"
import { AlertTriangle, X, Check, Loader2 } from "lucide-react"
import { submitCafeReport, ReportReason } from "@/app/api/actions/report"
import { useAuth } from "@/components/AuthProvider"
import { cn } from "@/utils/cn"

interface ReportCafeModalProps {
    cafeId: string
    isOpen: boolean
    onClose: () => void
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
    { value: "permanently_closed", label: "Permanently Closed" },
    { value: "does_not_exist", label: "Doesn't Exist" },
    { value: "other", label: "Other Issue" },
]

export default function ReportCafeModal({
    cafeId,
    isOpen,
    onClose,
}: ReportCafeModalProps) {
    const { user } = useAuth()
    const [reason, setReason] = useState<ReportReason | "">("")
    const [details, setDetails] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reason) return

        setIsSubmitting(true)
        setError(null)

        try {
            const result = await submitCafeReport(cafeId, reason, details)

            if (result.success) {
                setSuccess(true)
                setTimeout(() => {
                    onClose()
                    setSuccess(false)
                    setReason("")
                    setDetails("")
                }, 2000)
            } else {
                setError(result.error || "Failed to submit report")
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            {/* Backdrop */}
            <div
                className='absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'
                onClick={() => !isSubmitting && onClose()}
            />

            {/* Modal */}
            <div className='relative w-full max-w-md bg-background rounded-2xl shadow-xl ring-1 ring-text/10 overflow-hidden animate-in zoom-in-95 fade-in duration-200'>
                {success ? (
                    <div className='p-8 text-center flex flex-col items-center justify-center space-y-4'>
                        <div className='w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-500'>
                            <Check className='w-6 h-6' />
                        </div>
                        <div>
                            <h3 className='text-lg font-semibold text-text'>
                                Report Submitted
                            </h3>
                            <p className='text-text/60 mt-1'>
                                Thank you for help keeping our community
                                updated.
                            </p>
                        </div>
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className='p-6'
                    >
                        <div className='flex items-center justify-between mb-6'>
                            <div className='flex items-center gap-3'>
                                <div className='w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500'>
                                    <AlertTriangle className='w-5 h-5' />
                                </div>
                                <div>
                                    <h3 className='text-lg font-semibold text-text'>
                                        Report Changes
                                    </h3>
                                    <p className='text-xs text-text/60'>
                                        Flag this cafe if it's closed or has
                                        issues
                                    </p>
                                </div>
                            </div>
                            <button
                                type='button'
                                onClick={onClose}
                                className='p-2 text-text/40 hover:text-text hover:bg-text/5 rounded-lg transition-colors'
                                disabled={isSubmitting}
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        {error && (
                            <div className='mb-4 p-3 bg-red-500/10 text-red-600 text-sm rounded-lg flex items-start gap-2'>
                                <AlertTriangle className='w-4 h-4 shrink-0 mt-0.5' />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className='space-y-4'>
                            <div className='space-y-2'>
                                <label className='text-sm font-medium text-text/80'>
                                    Reason
                                </label>
                                <select
                                    value={reason}
                                    onChange={(e) =>
                                        setReason(
                                            e.target.value as ReportReason
                                        )
                                    }
                                    required
                                    className='w-full px-3 py-2 bg-tertiary/10 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-text sm:text-sm'
                                    disabled={isSubmitting}
                                >
                                    <option
                                        value=''
                                        disabled
                                    >
                                        Select a reason...
                                    </option>
                                    {REPORT_REASONS.map((r) => (
                                        <option
                                            key={r.value}
                                            value={r.value}
                                        >
                                            {r.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className='space-y-2'>
                                <label className='text-sm font-medium text-text/80'>
                                    Additional Details
                                    <span className='text-text/40 font-normal ml-1'>
                                        (Optional)
                                    </span>
                                </label>
                                <textarea
                                    value={details}
                                    onChange={(e) => setDetails(e.target.value)}
                                    rows={3}
                                    className='w-full px-3 py-2 bg-tertiary/10 border border-text/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-text sm:text-sm resize-none'
                                    placeholder='Please provide specific details...'
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div className='mt-6 flex gap-3'>
                            <button
                                type='button'
                                onClick={onClose}
                                className='flex-1 px-4 py-2 text-sm font-medium text-text/60 hover:text-text hover:bg-text/5 rounded-xl transition-colors'
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type='submit'
                                disabled={!reason || isSubmitting}
                                className='flex-1 px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className='w-4 h-4 animate-spin' />
                                        Submitting...
                                    </>
                                ) : (
                                    "Submit Report"
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
