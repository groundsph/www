"use client"

import { motion } from "motion/react"
import { Check, Loader2, AlertCircle, Circle, X } from "lucide-react"
import { cn } from "@/utils/cn"

export type SubmissionStepState = "pending" | "active" | "done" | "error"

export interface SubmissionStep {
    id: string
    label: string
    state: SubmissionStepState
    /** Optional sub-label, e.g. "2 of 5 photos". */
    detail?: string
    /** 0-100, meaningful while the step is uploading. */
    progress?: number
}

/** Average completion across steps, so the bar only reaches 100% when every step is done. */
export function calculateOverallProgress(steps: SubmissionStep[]): number {
    if (steps.length === 0) return 0

    const total = steps.reduce((sum, step) => {
        if (step.state === "done") return sum + 1
        if (step.state === "active") return sum + Math.min(Math.max(step.progress ?? 0, 0), 100) / 100
        return sum
    }, 0)

    return Math.round((total / steps.length) * 100)
}

function StepIcon({ state }: { state: SubmissionStepState }) {
    if (state === "done") {
        return (
            <span className='w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0'>
                <Check className='w-3 h-3 text-green-600' />
            </span>
        )
    }
    if (state === "error") {
        return (
            <span className='w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center shrink-0'>
                <AlertCircle className='w-3 h-3 text-red-600' />
            </span>
        )
    }
    if (state === "active") {
        return (
            <span className='w-5 h-5 flex items-center justify-center shrink-0'>
                <Loader2 className='w-4 h-4 text-primary animate-spin' />
            </span>
        )
    }
    return (
        <span className='w-5 h-5 flex items-center justify-center shrink-0'>
            <Circle className='w-2.5 h-2.5 text-text/25' />
        </span>
    )
}

interface SubmissionProgressProps {
    steps: SubmissionStep[]
    /** Shown under the list, e.g. the current failure reason. */
    error?: string | null
    className?: string
    /** When provided, renders a close button so the finished report can be dismissed. */
    onDismiss?: () => void
}

/**
 * Live, per-step report of a cafe submission.
 *
 * Shows what is happening right now (compressing, uploading 2 of 5 photos,
 * creating the cafe, filing the claim) instead of a single opaque spinner, so
 * a failure points at the exact step that broke.
 */
export default function SubmissionProgress({ steps, error, className, onDismiss }: SubmissionProgressProps) {
    if (steps.length === 0) return null

    const overall = calculateOverallProgress(steps)

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={cn(
                "bg-background border border-text/10 rounded-xl shadow-lg p-4",
                className,
            )}
            role='status'
            aria-live='polite'
        >
            <div className='flex items-center justify-between mb-2'>
                <p className='text-sm font-medium'>
                    {steps.some((step) => step.state === "error") ? "Submission stopped" : "Submitting your cafe"}
                </p>
                <div className='flex items-center gap-2'>
                    <span className='text-xs font-mono font-medium text-text/50'>{overall}%</span>
                    {onDismiss && (
                        <button
                            type='button'
                            onClick={onDismiss}
                            aria-label='Hide submission report'
                            className='p-0.5 rounded text-text/40 hover:text-text hover:bg-text/10 transition-colors'
                        >
                            <X className='w-3.5 h-3.5' />
                        </button>
                    )}
                </div>
            </div>

            <div className='h-1.5 bg-text/10 rounded-full overflow-hidden mb-3'>
                <motion.div
                    className='h-full bg-primary rounded-full'
                    animate={{ width: `${overall}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            <ol className='space-y-2'>
                {steps.map((step) => (
                    <li key={step.id} className='flex items-start gap-2'>
                        <StepIcon state={step.state} />
                        <div className='flex-1 min-w-0'>
                            <div className='flex items-center justify-between gap-2'>
                                <span
                                    className={cn(
                                        "text-xs leading-5 truncate",
                                        step.state === "pending" && "text-text/40",
                                        step.state === "active" && "text-text font-medium",
                                        step.state === "done" && "text-text/70",
                                        step.state === "error" && "text-red-600 font-medium",
                                    )}
                                >
                                    {step.label}
                                </span>
                                {step.detail && (
                                    <span className='text-[10px] text-text/40 shrink-0'>{step.detail}</span>
                                )}
                            </div>
                            {step.state === "active" && step.progress !== undefined && step.progress < 100 && (
                                <div className='h-1 bg-text/10 rounded-full overflow-hidden mt-1'>
                                    <div
                                        className='h-full bg-primary rounded-full transition-all duration-300'
                                        style={{ width: `${step.progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ol>

            {error && (
                <p className='mt-3 text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2'>
                    {error}
                </p>
            )}

            {!steps.some((step) => step.state === "error") && (
                <p className='mt-3 text-[10px] text-text/40'>
                    Keep this tab open until the submission finishes.
                </p>
            )}
        </motion.div>
    )
}
