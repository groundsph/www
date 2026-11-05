"use client"

import { useState } from "react"
import {
    AlertCircle,
    CheckCircle,
    Clock,
    ExternalLink,
    FileText,
    Loader2,
    RefreshCw,
    ShieldCheck,
    XCircle,
} from "lucide-react"
import {
    approveVerification,
    getAllVerifications,
    rejectVerification,
    sendVerificationEmail,
    type OwnerVerificationForAdmin,
} from "@/app/api/actions/admin"
import { getOwnershipProofSignedUrl } from "@/app/api/actions/claim"
import type {
    VerificationStatus,
    VerificationType,
} from "@/utils/types/owner"
import RejectVerificationModal from "./RejectVerificationModal"

const TYPE_LABELS: Record<VerificationType, string> = {
    document: "Business document",
    email: "Domain email",
    social_proof: "Official social account",
}

const STATUS_LABELS: Record<VerificationStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
}

type FilterValue = VerificationStatus | "all"

const FILTERS: Array<{ value: FilterValue; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
]

/** Approval and the notification email are separate outcomes; track both. */
type EmailState = "sending" | "sent" | "failed"

interface ActionOutcome {
    approved: boolean
    email?: EmailState
    emailError?: string
    rejectionReason?: string
}

interface ProofState {
    loading: boolean
    error?: string
}

interface BannerMessage {
    kind: "success" | "error"
    text: string
}

interface VerificationsQueueProps {
    initialRequests: OwnerVerificationForAdmin[]
}

function formatSubmittedDate(value: string | null): string {
    if (!value) return "Unknown date"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Unknown date"
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

export default function VerificationsQueue({
    initialRequests,
}: VerificationsQueueProps) {
    const [requests, setRequests] =
        useState<OwnerVerificationForAdmin[]>(initialRequests)
    const [filter, setFilter] = useState<FilterValue>("pending")
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [rejectTarget, setRejectTarget] =
        useState<OwnerVerificationForAdmin | null>(null)
    const [outcomes, setOutcomes] = useState<Record<string, ActionOutcome>>({})
    const [proofStates, setProofStates] = useState<Record<string, ProofState>>(
        {}
    )
    const [message, setMessage] = useState<BannerMessage | null>(null)

    const sendApprovalEmail = async (requestId: string) => {
        setOutcomes((prev) => ({
            ...prev,
            [requestId]: { ...prev[requestId], approved: true, email: "sending" },
        }))

        try {
            const result = await sendVerificationEmail(requestId)
            setOutcomes((prev) => ({
                ...prev,
                [requestId]: {
                    ...prev[requestId],
                    approved: true,
                    email: result.success ? "sent" : "failed",
                    emailError: result.success
                        ? undefined
                        : result.error || "Unknown error",
                },
            }))
        } catch (error) {
            setOutcomes((prev) => ({
                ...prev,
                [requestId]: {
                    ...prev[requestId],
                    approved: true,
                    email: "failed",
                    emailError:
                        error instanceof Error ? error.message : "Unknown error",
                },
            }))
        }
    }

    const loadRequests = async (status: FilterValue) => {
        setLoading(true)
        setLoadError(null)

        try {
            const data =
                status === "all"
                    ? await getAllVerifications()
                    : await getAllVerifications(status)
            setRequests(data)
        } catch (error) {
            console.error("Error loading verification requests:", error)
            setLoadError(
                "Could not load verification requests. Try refreshing the list."
            )
        } finally {
            setLoading(false)
        }
    }

    const handleFilterChange = async (next: FilterValue) => {
        if (next === filter && !loadError) return

        setFilter(next)
        await loadRequests(next)
    }

    const handleApprove = async (request: OwnerVerificationForAdmin) => {
        if (processingId) return

        setProcessingId(request.id)
        setMessage(null)

        try {
            const result = await approveVerification(request.id)

            if (!result.success) {
                setMessage({
                    kind: "error",
                    text:
                        result.error ||
                        "Could not approve this ownership request.",
                })
                return
            }

            // Approval grants ownership. Mark it locally so the row stops
            // offering decisions, then notify the owner separately.
            setRequests((prev) =>
                prev.map((item) =>
                    item.id === request.id
                        ? { ...item, status: "approved" as VerificationStatus }
                        : item
                )
            )
            setOutcomes((prev) => ({
                ...prev,
                [request.id]: { approved: true, email: "sending" },
            }))

            await sendApprovalEmail(request.id)
        } catch (error) {
            console.error("Error approving verification:", error)
            setMessage({
                kind: "error",
                text: "Could not approve this ownership request.",
            })
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (reason: string) => {
        const target = rejectTarget
        if (!target || processingId) return

        setProcessingId(target.id)

        try {
            const result = await rejectVerification(target.id, reason)

            if (!result.success) {
                throw new Error(
                    result.error || "Could not reject this ownership request."
                )
            }

            setRequests((prev) =>
                prev.map((item) =>
                    item.id === target.id
                        ? {
                              ...item,
                              status: "rejected" as VerificationStatus,
                              admin_notes: reason,
                          }
                        : item
                )
            )
            setOutcomes((prev) => ({
                ...prev,
                [target.id]: { approved: false, rejectionReason: reason },
            }))
            setMessage({
                kind: "success",
                text: `Rejected the ownership request for ${
                    target.cafe?.name ?? "this cafe"
                }.`,
            })
            setRejectTarget(null)
        } catch (error) {
            console.error("Error rejecting verification:", error)
            setMessage({
                kind: "error",
                text:
                    error instanceof Error
                        ? error.message
                        : "Could not reject this ownership request.",
            })
            throw error
        } finally {
            setProcessingId(null)
        }
    }

    const handleViewProof = async (
        requestId: string,
        proofUrl: string,
        index: number
    ) => {
        const key = `${requestId}:${index}`
        setProofStates((prev) => ({ ...prev, [key]: { loading: true } }))

        try {
            const result = await getOwnershipProofSignedUrl(proofUrl)

            if (!result.success || !result.url) {
                setProofStates((prev) => ({
                    ...prev,
                    [key]: {
                        loading: false,
                        error:
                            result.error ||
                            "Could not open this proof document.",
                    },
                }))
                return
            }

            setProofStates((prev) => ({ ...prev, [key]: { loading: false } }))
            window.open(result.url, "_blank", "noopener,noreferrer")
        } catch (error) {
            console.error("Error opening proof document:", error)
            setProofStates((prev) => ({
                ...prev,
                [key]: {
                    loading: false,
                    error: "Could not open this proof document.",
                },
            }))
        }
    }

    const emptyStateCopy: Record<FilterValue, string> = {
        pending: "No ownership requests are waiting for review.",
        approved: "No ownership requests have been approved yet.",
        rejected: "No ownership requests have been rejected yet.",
        all: "No ownership requests have been submitted yet.",
    }

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
                <div>
                    <h1 className='font-serif text-2xl md:text-3xl font-bold text-text'>
                        Ownership Verifications
                    </h1>
                    <p className='text-text/60 mt-1'>
                        Review proof submitted by cafe owners before granting
                        them access to a listing.
                    </p>
                </div>
                <button
                    type='button'
                    onClick={() => void loadRequests(filter)}
                    disabled={loading}
                    className='inline-flex items-center gap-1.5 self-start rounded-lg border border-text/10 bg-text/5 px-3 py-2 text-sm font-medium text-text/70 transition-colors hover:bg-text/10 disabled:opacity-50'
                >
                    <RefreshCw
                        className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                </button>
            </div>

            <div className='flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3'>
                <ShieldCheck className='mt-0.5 w-4 h-4 shrink-0 text-primary' />
                <p className='text-sm text-text'>
                    Approving grants ownership of the cafe to the requester. It
                    does not verify the cafe or grant a verified badge — that
                    stays a separate decision.
                </p>
            </div>

            {/* Status filter */}
            <div className='flex flex-wrap gap-2'>
                {FILTERS.map((option) => {
                    const isActive = filter === option.value
                    return (
                        <button
                            key={option.value}
                            type='button'
                            onClick={() => void handleFilterChange(option.value)}
                            aria-pressed={isActive}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                                isActive
                                    ? "bg-primary text-background"
                                    : "bg-tertiary/40 text-text/70 hover:bg-tertiary"
                            }`}
                        >
                            {option.label}
                        </button>
                    )
                })}
            </div>

            {message && (
                <p
                    role='status'
                    className={`rounded-xl border p-3 text-sm text-text ${
                        message.kind === "success"
                            ? "border-green-500/30 bg-green-500/10"
                            : "border-red-500/30 bg-red-500/10"
                    }`}
                >
                    {message.text}
                </p>
            )}

            {/* List */}
            <div className='space-y-4'>
                {loading ? (
                    <p className='flex items-center justify-center gap-2 rounded-xl border border-tertiary/50 bg-background py-16 text-sm text-text/70'>
                        <Loader2 className='w-4 h-4 animate-spin' />
                        Loading requests…
                    </p>
                ) : loadError ? (
                    <div className='rounded-xl border border-red-500/30 bg-red-500/10 py-16 text-center'>
                        <AlertCircle className='mx-auto mb-3 w-10 h-10 text-red-600' />
                        <p className='text-text'>{loadError}</p>
                        <button
                            type='button'
                            onClick={() => void loadRequests(filter)}
                            className='mt-4 rounded-lg border border-text/10 bg-background px-3 py-2 text-sm font-medium text-text hover:bg-text/5 transition-colors'
                        >
                            Try again
                        </button>
                    </div>
                ) : requests.length === 0 ? (
                    <div className='rounded-xl border border-tertiary/50 bg-background py-16 text-center'>
                        <FileText className='mx-auto mb-4 w-12 h-12 text-text opacity-30' />
                        <p className='text-text/60 text-lg'>
                            {emptyStateCopy[filter]}
                        </p>
                    </div>
                ) : (
                    requests.map((request) => {
                        const outcome = outcomes[request.id]
                        const isProcessing = processingId === request.id
                        const isPending = request.status === "pending"
                        const proofUrls = request.proof_urls ?? []

                        return (
                            <article
                                key={request.id}
                                className='rounded-xl border border-tertiary/50 bg-background p-5 shadow-sm space-y-4'
                            >
                                <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                                    <div className='min-w-0'>
                                        <h2 className='font-serif text-lg font-semibold text-text truncate'>
                                            {request.cafe?.name ??
                                                "Cafe no longer exists"}
                                        </h2>
                                        <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text/60'>
                                            {request.cafe?.slug && (
                                                <span>/{request.cafe.slug}</span>
                                            )}
                                            <span>
                                                Requested by{" "}
                                                {request.user?.display_name ||
                                                    request.user?.username ||
                                                    "unknown user"}
                                            </span>
                                            {request.user?.username && (
                                                <span>
                                                    @{request.user.username}
                                                </span>
                                            )}
                                            <span>
                                                {formatSubmittedDate(
                                                    request.created_at
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <span className='rounded-full bg-tertiary/60 px-3 py-1 text-xs font-medium text-text'>
                                            {
                                                TYPE_LABELS[
                                                    request.verification_type
                                                ]
                                            }
                                        </span>
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                                                request.status === "pending"
                                                    ? "bg-amber-500/15 text-amber-700"
                                                    : request.status ===
                                                        "approved"
                                                      ? "bg-green-500/15 text-green-700"
                                                      : "bg-red-500/15 text-red-700"
                                            }`}
                                        >
                                            {STATUS_LABELS[request.status]}
                                        </span>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className='rounded-lg border border-text/10 bg-text/5 p-3'>
                                    <p className='text-xs font-medium text-text/60'>
                                        Message from the requester
                                    </p>
                                    <p className='mt-1 text-sm text-text whitespace-pre-line'>
                                        {request.notes?.trim()
                                            ? request.notes
                                            : "No notes were included with this request."}
                                    </p>
                                </div>

                                {/* Proof documents (private objects) */}
                                <div className='space-y-2'>
                                    <p className='text-xs font-medium text-text/60'>
                                        Proof
                                    </p>
                                    {proofUrls.length === 0 ? (
                                        <p className='text-sm text-text/70'>
                                            No proof document is attached to
                                            this request.
                                        </p>
                                    ) : (
                                        <div className='flex flex-wrap gap-2'>
                                            {proofUrls.map((proofUrl, index) => {
                                                const key = `${request.id}:${index}`
                                                const state = proofStates[key]

                                                return (
                                                    <div
                                                        key={key}
                                                        className='space-y-1'
                                                    >
                                                        <button
                                                            type='button'
                                                            onClick={() =>
                                                                void handleViewProof(
                                                                    request.id,
                                                                    proofUrl,
                                                                    index
                                                                )
                                                            }
                                                            disabled={
                                                                state?.loading
                                                            }
                                                            className='inline-flex items-center gap-1.5 rounded-lg border border-text/10 bg-text/5 px-3 py-2 text-sm font-medium text-text hover:bg-text/10 transition-colors disabled:opacity-50'
                                                        >
                                                            {state?.loading ? (
                                                                <Loader2 className='w-4 h-4 animate-spin' />
                                                            ) : (
                                                                <ExternalLink className='w-4 h-4' />
                                                            )}
                                                            {proofUrls.length >
                                                            1
                                                                ? `View proof ${
                                                                      index + 1
                                                                  }`
                                                                : "View proof"}
                                                        </button>
                                                        {state?.error && (
                                                            <p
                                                                role='alert'
                                                                className='text-xs text-red-700'
                                                            >
                                                                {state.error}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Outcome of this session's action */}
                                {outcome && (
                                    <div className='rounded-lg border border-text/10 bg-text/5 p-3 space-y-1 text-sm'>
                                        {outcome.approved ? (
                                            <>
                                                <p className='flex items-center gap-2 font-medium text-text'>
                                                    <CheckCircle className='w-4 h-4 text-green-700' />
                                                    Approved — ownership
                                                    granted
                                                </p>
                                                {outcome.email ===
                                                    "sending" && (
                                                    <p className='flex items-center gap-2 text-text/70'>
                                                        <Loader2 className='w-3.5 h-3.5 animate-spin' />
                                                        Sending the notification
                                                        email…
                                                    </p>
                                                )}
                                                {outcome.email === "sent" && (
                                                    <p className='text-green-700'>
                                                        Notification email sent to
                                                        the requester.
                                                    </p>
                                                )}
                                                {outcome.email === "failed" && (
                                                    <div className='space-y-2'>
                                                        <p className='flex items-start gap-2 text-red-700'>
                                                            <AlertCircle className='mt-0.5 w-4 h-4 shrink-0' />
                                                            <span>
                                                                Approval
                                                                succeeded, but the
                                                                notification
                                                                email failed
                                                                {outcome.emailError
                                                                    ? `: ${outcome.emailError}`
                                                                    : "."}
                                                            </span>
                                                        </p>
                                                        <button
                                                            type='button'
                                                            onClick={() =>
                                                                void sendApprovalEmail(
                                                                    request.id
                                                                )
                                                            }
                                                            className='rounded-lg border border-text/10 bg-background px-3 py-1.5 text-xs font-medium text-text hover:bg-text/5 transition-colors'
                                                        >
                                                            Retry email
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <p className='flex items-center gap-2 font-medium text-text'>
                                                    <XCircle className='w-4 h-4 text-red-700' />
                                                    Rejected — ownership not
                                                    granted
                                                </p>
                                                {outcome.rejectionReason && (
                                                    <p className='text-text/70'>
                                                        Reason sent to the
                                                        requester:{" "}
                                                        {
                                                            outcome.rejectionReason
                                                        }
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                {isPending && !outcome && (
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <button
                                            type='button'
                                            onClick={() =>
                                                void handleApprove(request)
                                            }
                                            disabled={Boolean(processingId)}
                                            className='inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50'
                                        >
                                            {isProcessing ? (
                                                <Loader2 className='w-4 h-4 animate-spin' />
                                            ) : (
                                                <CheckCircle className='w-4 h-4' />
                                            )}
                                            Approve ownership
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() =>
                                                setRejectTarget(request)
                                            }
                                            disabled={Boolean(processingId)}
                                            className='inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-500/20 transition-colors disabled:opacity-50'
                                        >
                                            <XCircle className='w-4 h-4' />
                                            Reject
                                        </button>
                                    </div>
                                )}

                                {!isPending && !outcome && (
                                    <div className='flex items-start gap-2 text-sm text-text/70'>
                                        {request.status === "approved" ? (
                                            <Clock className='mt-0.5 w-4 h-4 shrink-0' />
                                        ) : (
                                            <XCircle className='mt-0.5 w-4 h-4 shrink-0' />
                                        )}
                                        <span>
                                            {request.status === "approved"
                                                ? "Ownership was already granted for this request."
                                                : "This request was rejected."}
                                            {request.admin_notes
                                                ? ` Reason: ${request.admin_notes}`
                                                : ""}
                                        </span>
                                    </div>
                                )}
                            </article>
                        )
                    })
                )}
            </div>

            {rejectTarget && (
                <RejectVerificationModal
                    cafeName={rejectTarget.cafe?.name ?? "this cafe"}
                    onClose={() => setRejectTarget(null)}
                    onConfirm={handleReject}
                    isProcessing={processingId === rejectTarget.id}
                />
            )}
        </div>
    )
}
