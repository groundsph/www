"use client"

import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"

export interface ConfirmOptions {
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
}

export interface ConfirmDialogProps extends ConfirmOptions {
    open: boolean
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}

/**
 * A plain confirm dialog. `ActionConfirmationModal` is for sensitive actions
 * (password/TOTP); this one replaces `window.confirm()` in the management UI.
 */
export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const confirmRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!open) return
        confirmRef.current?.focus()
    }, [open])

    if (!open) return null

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            <div
                className='absolute inset-0 bg-black/50'
                onClick={() => { if (!busy) onCancel() }}
                aria-hidden='true'
            />
            <div
                role='dialog'
                aria-modal='true'
                aria-label={title}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && !busy) {
                        event.stopPropagation()
                        onCancel()
                    }
                }}
                className='relative w-full max-w-md rounded-xl border border-tertiary/50 bg-background p-5 shadow-lg'
            >
                <h2 className='text-lg font-semibold text-text'>{title}</h2>
                {description && <p className='mt-2 text-sm text-text/60'>{description}</p>}

                <div className='mt-5 flex justify-end gap-2'>
                    <button
                        type='button'
                        onClick={onCancel}
                        disabled={busy}
                        className='rounded-lg bg-text/10 px-4 py-2 text-sm transition hover:bg-text/20 disabled:opacity-50'
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type='button'
                        onClick={onConfirm}
                        disabled={busy}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white transition disabled:opacity-50",
                            destructive ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {busy && <Loader2 className='h-4 w-4 animate-spin' />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
