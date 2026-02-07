"use client"

import { useState } from "react"
import {
    Check,
    X,
    Loader2,
    CreditCard,
    AlertCircle,
    Calendar,
    CalendarRange,
    Clock,
    Image as ImageIcon,
} from "lucide-react"
import {
    CafeSubscription,
    SUBSCRIPTION_TIERS,
    toDisplayTier,
    type SubscriptionTier,
} from "@/utils/types/owner"
import {
    verifyManualPayment,
    rejectManualPayment,
    deleteSubscriptionProof,
} from "@/app/api/actions/admin"
import { useNotification } from "@/components/layout/NotificationProvider"

// Extend CafeSubscription to include the joined 'cafes' relation
interface SubscriptionWithCafe extends CafeSubscription {
    cafes: {
        id: string
        name: string
        slug: string
    } | null
}

interface SubscriptionsTableProps {
    initialSubscriptions: SubscriptionWithCafe[]
}

export default function SubscriptionsTable({
    initialSubscriptions,
}: SubscriptionsTableProps) {
    const [subscriptions, setSubscriptions] =
        useState<SubscriptionWithCafe[]>(initialSubscriptions)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [selectedProof, setSelectedProof] = useState<string | null>(null)
    const [rejectId, setRejectId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState("")
    const { addNotification } = useNotification()

    // Helper to format date safely
    const formatDate = (dateString: string | null) => {
        if (!dateString) return "N/A"
        return new Date(dateString).toLocaleDateString()
    }

    // Helper to download a file with a specific filename
    const downloadFile = async (url: string, filename: string) => {
        try {
            const response = await fetch(url)
            const blob = await response.blob()
            const blobUrl = window.URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = blobUrl
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(blobUrl)
        } catch (error) {
            console.error("Failed to download file:", error)
        }
    }

    const handleVerify = async (cafeId: string, subscriptionId: string) => {
        if (
            !confirm(
                "Are you sure you want to verify this payment? The proof of payment will be downloaded and then deleted from storage."
            )
        )
            return

        setActionLoading(subscriptionId)
        try {
            const result = await verifyManualPayment(cafeId, subscriptionId)
            if (result.success) {
                // Download the proof file before deleting it from storage
                if (result.proofInfo) {
                    await downloadFile(
                        result.proofInfo.url,
                        result.proofInfo.filename
                    )
                    // Delete the proof file from storage after download
                    await deleteSubscriptionProof(result.proofInfo.url)
                    addNotification(
                        "Payment verified, proof downloaded and deleted from storage",
                        "success"
                    )
                } else {
                    addNotification("Payment verified successfully", "success")
                }
                setSubscriptions((prev) =>
                    prev.map((sub) =>
                        sub.id === subscriptionId
                            ? {
                                  ...sub,
                                  payment_verified: true,
                                  status: "active",
                                  proof_of_payment_url: null, // Clear the proof URL
                              }
                            : sub
                    )
                )
            } else {
                addNotification(
                    result.error || "Failed to verify payment",
                    "error"
                )
            }
        } catch (error) {
            console.error(error)
            addNotification("An unexpected error occurred", "error")
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async () => {
        if (!rejectId) return

        const subToReject = subscriptions.find((s) => s.id === rejectId)
        if (!subToReject) return

        setActionLoading(rejectId)
        try {
            const result = await rejectManualPayment(
                subToReject.cafe_id,
                rejectId,
                rejectReason
            )
            if (result.success) {
                addNotification("Payment rejected", "success")
                setSubscriptions((prev) =>
                    prev.filter((sub) => sub.id !== rejectId)
                )
                setRejectId(null)
                setRejectReason("")
            } else {
                addNotification(
                    result.error || "Failed to reject payment",
                    "error"
                )
            }
        } catch (error) {
            console.error(error)
            addNotification("An unexpected error occurred", "error")
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <div className='bg-background rounded-xl shadow-sm border border-tertiary/50 overflow-hidden'>
            <div className='overflow-x-auto'>
                <table className='w-full'>
                    <thead>
                        <tr className='border-b border-tertiary/50 bg-tertiary/5'>
                            <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text/60'>
                                Cafe
                            </th>
                            <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text/60'>
                                Plan
                            </th>
                            <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text/60'>
                                Amount
                            </th>
                            <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text/60'>
                                Submitted
                            </th>
                            <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text/60'>
                                Period
                            </th>
                            <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text/60'>
                                Proof
                            </th>
                            <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text/60'>
                                Status
                            </th>
                            <th className='px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text/60'>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-tertiary/50'>
                        {subscriptions.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className='px-6 py-12 text-center text-text/60'
                                >
                                    <div className='flex flex-col items-center gap-2'>
                                        <CreditCard className='w-8 h-8 opacity-20' />
                                        <p>No subscriptions found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            subscriptions.map((sub) => (
                                <tr
                                    key={sub.id}
                                    className='hover:bg-tertiary/5 transition-colors'
                                >
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        <div className='flex flex-col'>
                                            <span className='font-medium'>
                                                {sub.cafes?.name ||
                                                    "Unknown Cafe"}
                                            </span>
                                            <span className='text-xs text-text/40 font-mono'>
                                                {sub.cafes?.slug}
                                            </span>
                                        </div>
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        {(() => {
                                            const displayTier = toDisplayTier(
                                                sub.tier as
                                                    | "free"
                                                    | "basic"
                                                    | "premium"
                                            )
                                            const tierConfig =
                                                SUBSCRIPTION_TIERS[
                                                    displayTier as SubscriptionTier
                                                ]
                                            return (
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                                        displayTier ===
                                                        "premium"
                                                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                                                            : displayTier ===
                                                                "pro"
                                                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                                                              : "bg-gray-100 text-gray-800 border border-gray-200"
                                                    }`}
                                                >
                                                    {tierConfig?.name ||
                                                        displayTier}
                                                </span>
                                            )
                                        })()}
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        {(() => {
                                            const displayTier = toDisplayTier(
                                                sub.tier as
                                                    | "free"
                                                    | "basic"
                                                    | "premium"
                                            )
                                            const tierConfig =
                                                SUBSCRIPTION_TIERS[
                                                    displayTier as SubscriptionTier
                                                ]
                                            return (
                                                <span className='font-medium font-mono'>
                                                    ₱
                                                    {tierConfig?.price.toLocaleString() ||
                                                        "0"}
                                                </span>
                                            )
                                        })()}
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap text-sm text-text/60'>
                                        <div className='flex items-center gap-1.5'>
                                            <Calendar className='w-3.5 h-3.5' />
                                            {formatDate(sub.created_at)}
                                        </div>
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap text-sm text-text/60'>
                                        {sub.current_period_start ||
                                        sub.current_period_end ? (
                                            <div className='flex items-center gap-1.5'>
                                                <CalendarRange className='w-3.5 h-3.5' />
                                                <span>
                                                    {formatDate(
                                                        sub.current_period_start
                                                    )}{" "}
                                                    -{" "}
                                                    {formatDate(
                                                        sub.current_period_end
                                                    )}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className='text-text/40'>
                                                Not set
                                            </span>
                                        )}
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        {sub.proof_of_payment_url ? (
                                            <button
                                                onClick={() =>
                                                    setSelectedProof(
                                                        sub.proof_of_payment_url ||
                                                            null
                                                    )
                                                }
                                                className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
                                            >
                                                <ImageIcon className='w-3.5 h-3.5' />
                                                View
                                            </button>
                                        ) : (
                                            <span className='text-text/40 text-sm'>
                                                No proof
                                            </span>
                                        )}
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        {sub.payment_verified ? (
                                            <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200'>
                                                <Check className='w-3 h-3' />
                                                Verified
                                            </span>
                                        ) : (
                                            <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200'>
                                                <Clock className='w-3 h-3' />
                                                Pending
                                            </span>
                                        )}
                                    </td>
                                    <td className='px-6 py-4 whitespace-nowrap'>
                                        <div className='flex items-center gap-2'>
                                            {!sub.payment_verified && (
                                                <>
                                                    <button
                                                        onClick={() =>
                                                            handleVerify(
                                                                sub.cafe_id,
                                                                sub.id
                                                            )
                                                        }
                                                        disabled={
                                                            actionLoading ===
                                                            sub.id
                                                        }
                                                        className='p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors'
                                                        title='Verify Payment'
                                                    >
                                                        {actionLoading ===
                                                        sub.id ? (
                                                            <Loader2 className='w-4 h-4 animate-spin' />
                                                        ) : (
                                                            <Check className='w-4 h-4' />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setRejectId(sub.id)
                                                        }
                                                        disabled={
                                                            actionLoading ===
                                                            sub.id
                                                        }
                                                        className='p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                                                        title='Reject Payment'
                                                    >
                                                        <X className='w-4 h-4' />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Proof Modal */}
            {selectedProof && (
                <div
                    className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
                    onClick={() => setSelectedProof(null)}
                >
                    <div
                        className='bg-background rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden'
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className='flex items-center justify-between mb-4'>
                            <h3 className='text-lg font-semibold'>
                                Proof of Payment
                            </h3>
                            <button
                                onClick={() => setSelectedProof(null)}
                                className='p-2 hover:bg-text/10 rounded-lg transition'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>
                        <div className='flex items-center justify-center'>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={selectedProof}
                                alt='Proof of Payment'
                                className='max-w-full max-h-[calc(90vh-120px)] object-contain rounded-lg'
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {rejectId && (
                <div
                    className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'
                    onClick={() => setRejectId(null)}
                >
                    <div
                        className='bg-background rounded-xl p-6 w-full max-w-md space-y-4'
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className='flex items-center gap-3 text-red-600'>
                            <AlertCircle className='w-6 h-6' />
                            <h3 className='text-lg font-bold'>
                                Reject Payment
                            </h3>
                        </div>
                        <p className='text-text/80 text-sm'>
                            Are you sure you want to reject this payment? This
                            will cancel the subscription submission.
                        </p>
                        <div>
                            <label className='block text-sm font-medium mb-1'>
                                Reason for Rejection
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) =>
                                    setRejectReason(e.target.value)
                                }
                                className='w-full p-3 bg-tertiary/10 border border-tertiary/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20'
                                rows={3}
                                placeholder='e.g. Invalid screenshot, wrong amount...'
                            />
                        </div>
                        <div className='flex gap-3 justify-end pt-2'>
                            <button
                                onClick={() => setRejectId(null)}
                                className='px-4 py-2 hover:bg-tertiary/10 rounded-lg transition text-sm font-medium'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!rejectReason.trim()}
                                className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2'
                            >
                                {actionLoading === rejectId ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    <X className='w-4 h-4' />
                                )}
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
