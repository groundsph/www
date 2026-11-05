"use client"

import { useCallback, useEffect, useState } from "react"
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Loader2,
    ShieldCheck,
} from "lucide-react"
import {
    getVerificationStatus,
    submitVerificationRequest,
} from "@/app/api/actions/owner"
import { uploadOwnershipProofWithProgress } from "@/utils/storage/client"
import type {
    OwnerVerificationRequest,
    VerificationType,
} from "@/utils/types/owner"

const VERIFICATION_TYPE_OPTIONS: Array<{
    value: VerificationType
    label: string
}> = [
    {
        value: "document",
        label: "Business document (permit, DTI/SEC registration)",
    },
    { value: "email", label: "Email on the cafe's domain" },
    { value: "social_proof", label: "Official social media account" },
]

const SHORT_TYPE_LABELS: Record<VerificationType, string> = {
    document: "business document",
    email: "domain email",
    social_proof: "social media account",
}

function formatSubmittedDate(value: string | null): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString()
}

interface VerificationPanelProps {
    cafeId: string
    cafeName: string
}

interface PanelMessage {
    kind: "success" | "error"
    text: string
}

export default function VerificationPanel({
    cafeId,
    cafeName,
}: VerificationPanelProps) {
    const [request, setRequest] = useState<OwnerVerificationRequest | null>(null)
    const [loading, setLoading] = useState(true)
    const [verificationType, setVerificationType] =
        useState<VerificationType>("document")
    const [notes, setNotes] = useState("")
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState<PanelMessage | null>(null)

    // Every setState here runs after an await, so the effect below does not
    // trigger a synchronous render cascade on mount.
    const loadStatus = useCallback(async () => {
        try {
            const next = await getVerificationStatus(cafeId)
            setRequest(next)
        } catch (error) {
            console.error("Error loading verification status:", error)
            setMessage({
                kind: "error",
                text: "Could not load your ownership status. Refresh the page to try again.",
            })
        } finally {
            setLoading(false)
        }
    }, [cafeId])

    useEffect(() => {
        void loadStatus()
    }, [loadStatus])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()

        if (!proofFile) {
            setMessage({
                kind: "error",
                text: "Attach one supporting file before sending your request.",
            })
            return
        }

        setSubmitting(true)
        setMessage(null)
        setUploadProgress(0)

        try {
            const upload = await uploadOwnershipProofWithProgress(
                proofFile,
                (progress) => setUploadProgress(progress)
            )

            if (!upload.success || !upload.url) {
                throw new Error(upload.error || "Failed to upload your proof")
            }

            const result = await submitVerificationRequest({
                cafe_id: cafeId,
                verification_type: verificationType,
                proof_urls: [upload.url],
                notes: notes.trim() ? notes.trim() : undefined,
            })

            if (!result.success) {
                setMessage({
                    kind: "error",
                    text:
                        result.error ||
                        "Could not send your request. Please try again.",
                })
                return
            }

            setMessage({
                kind: "success",
                text: "Request sent. This page shows the outcome once staff review it.",
            })
            setProofFile(null)
            setNotes("")
            setUploadProgress(0)
            await loadStatus()
        } catch (error) {
            console.error("Error submitting verification request:", error)
            setMessage({
                kind: "error",
                text:
                    error instanceof Error
                        ? error.message
                        : "Something went wrong. Please try again.",
            })
        } finally {
            setSubmitting(false)
        }
    }

    const canSubmit = !request || request.status === "rejected"
    const submittedDate = formatSubmittedDate(request?.created_at ?? null)

    return (
        <section
            aria-labelledby='ownership-verification-heading'
            className='rounded-xl border border-text/10 bg-text/5 p-6 space-y-5'
        >
            <div className='flex items-start gap-3'>
                <span className='rounded-full bg-tertiary p-2 text-primary'>
                    <ShieldCheck className='w-5 h-5' />
                </span>
                <div className='space-y-1'>
                    <h3
                        id='ownership-verification-heading'
                        className='font-serif text-lg font-semibold text-text'
                    >
                        Ownership verification
                    </h3>
                    <p className='text-sm text-text/70'>
                        Send proof that you run {cafeName}. GroundsPH staff
                        review every request by hand — nothing about your
                        listing changes while a request is open.
                    </p>
                </div>
            </div>

            <div className='rounded-lg border border-accent/30 bg-accent/5 p-3'>
                <p className='text-sm text-text'>
                    Approving ownership does not add a verified badge. A
                    verified badge is granted separately by GroundsPH staff.
                </p>
            </div>

            {loading ? (
                <p className='flex items-center gap-2 text-sm text-text/70'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    Checking your ownership status…
                </p>
            ) : (
                <>
                    {request?.status === "pending" && (
                        <div className='rounded-lg border border-secondary/40 bg-tertiary/60 p-4 space-y-1'>
                            <p className='flex items-center gap-2 font-medium text-text'>
                                <Clock className='w-4 h-4 text-primary' />
                                Under review
                            </p>
                            <p className='text-sm text-text/80'>
                                Staff have your{" "}
                                {SHORT_TYPE_LABELS[request.verification_type]}
                                {submittedDate
                                    ? ` submitted on ${submittedDate}`
                                    : ""}
                                . This page shows the outcome once they decide,
                                and you cannot send a second request while this
                                one is open.
                            </p>
                        </div>
                    )}

                    {request?.status === "approved" && (
                        <div className='rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-1'>
                            <p className='flex items-center gap-2 font-medium text-text'>
                                <CheckCircle2 className='w-4 h-4 text-green-700' />
                                Approved — you now manage this cafe
                            </p>
                            <p className='text-sm text-text/80'>
                                You manage {cafeName}. Its details, photos, menu
                                and owner replies on reviews are yours to edit.
                            </p>
                        </div>
                    )}

                    {request?.status === "rejected" && (
                        <div className='rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-1'>
                            <p className='flex items-center gap-2 font-medium text-text'>
                                <AlertCircle className='w-4 h-4 text-red-700' />
                                Your last request was not approved
                            </p>
                            {request.admin_notes ? (
                                <p className='text-sm text-text/80'>
                                    <span className='font-medium'>
                                        Reason from staff:
                                    </span>{" "}
                                    {request.admin_notes}
                                </p>
                            ) : (
                                <p className='text-sm text-text/80'>
                                    Staff did not leave a reason. You can send
                                    another request with different proof.
                                </p>
                            )}
                        </div>
                    )}

                    {message && (
                        <p
                            role='status'
                            className={`rounded-lg p-3 text-sm ${
                                message.kind === "success"
                                    ? "border border-green-500/30 bg-green-500/10 text-text"
                                    : "border border-red-500/30 bg-red-500/10 text-text"
                            }`}
                        >
                            {message.text}
                        </p>
                    )}

                    {canSubmit && (
                        <form
                            onSubmit={handleSubmit}
                            className='space-y-4 border-t border-text/10 pt-4'
                        >
                            <div className='space-y-1'>
                                <label
                                    htmlFor='verification-type'
                                    className='block text-sm font-medium text-text'
                                >
                                    What are you sending?
                                </label>
                                <select
                                    id='verification-type'
                                    value={verificationType}
                                    disabled={submitting}
                                    onChange={(event) =>
                                        setVerificationType(
                                            event.target.value as VerificationType
                                        )
                                    }
                                    className='w-full rounded-lg border border-text/15 bg-background px-3 py-2 text-sm text-text disabled:opacity-60'
                                >
                                    {VERIFICATION_TYPE_OPTIONS.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className='space-y-1'>
                                <label
                                    htmlFor='verification-proof'
                                    className='block text-sm font-medium text-text'
                                >
                                    Proof file
                                </label>
                                <input
                                    id='verification-proof'
                                    type='file'
                                    accept='.pdf,.png,.jpg,.jpeg,.webp'
                                    disabled={submitting}
                                    onChange={(event) => {
                                        setProofFile(event.target.files?.[0] ?? null)
                                        setMessage(null)
                                        setUploadProgress(0)
                                    }}
                                    className='w-full rounded-lg border border-dashed border-text/20 bg-background px-3 py-2 text-sm text-text disabled:opacity-60'
                                />
                                <p className='text-xs text-text/70'>
                                    One file, up to 10MB — PDF or image. Proof
                                    is stored privately and only staff can open
                                    it.
                                </p>
                            </div>

                            {submitting && uploadProgress > 0 && (
                                <div className='space-y-1'>
                                    <div className='h-2 w-full overflow-hidden rounded-full bg-text/10'>
                                        <div
                                            className='h-full bg-primary transition-all'
                                            style={{
                                                width: `${uploadProgress}%`,
                                            }}
                                        />
                                    </div>
                                    <p className='text-xs text-text/70'>
                                        Uploading… {uploadProgress}%
                                    </p>
                                </div>
                            )}

                            <div className='space-y-1'>
                                <label
                                    htmlFor='verification-notes'
                                    className='block text-sm font-medium text-text'
                                >
                                    Notes (optional)
                                </label>
                                <textarea
                                    id='verification-notes'
                                    value={notes}
                                    rows={3}
                                    disabled={submitting}
                                    onChange={(event) =>
                                        setNotes(event.target.value)
                                    }
                                    placeholder='Anything that helps staff match this proof to the cafe.'
                                    className='w-full rounded-lg border border-text/15 bg-background px-3 py-2 text-sm text-text placeholder:text-text/50 disabled:opacity-60'
                                />
                            </div>

                            <button
                                type='submit'
                                disabled={submitting || !proofFile}
                                className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60'
                            >
                                {submitting ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    <ShieldCheck className='w-4 h-4' />
                                )}
                                {submitting
                                    ? "Sending request…"
                                    : "Send ownership request"}
                            </button>
                        </form>
                    )}
                </>
            )}
        </section>
    )
}
