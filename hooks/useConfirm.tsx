"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import ConfirmDialog, { type ConfirmOptions } from "@/components/ui/ConfirmDialog"

interface PendingConfirm extends ConfirmOptions {
    resolve: (value: boolean) => void
}

/**
 * Promise-based confirm, so existing `if (!confirm(...)) return` sites keep
 * their shape: `if (!(await confirm({ title: "Remove image?" }))) return`.
 *
 * Render the returned `dialog` node once in the component.
 */
export function useConfirm(): {
    confirm: (options: ConfirmOptions) => Promise<boolean>
    dialog: ReactNode
    /** Settles the pending prompt; the dialog's own buttons call this. */
    dialogResolve: (value: boolean) => void
} {
    const [pending, setPending] = useState<PendingConfirm | null>(null)
    const pendingRef = useRef<PendingConfirm | null>(null)

    const settle = useCallback((value: boolean) => {
        const current = pendingRef.current
        pendingRef.current = null
        setPending(null)
        current?.resolve(value)
    }, [])

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            const next: PendingConfirm = { ...options, resolve }
            pendingRef.current = next
            setPending(next)
        })
    }, [])

    return {
        confirm,
        dialogResolve: settle,
        dialog: pending ? (
            <ConfirmDialog
                open
                {...pending}
                onConfirm={() => settle(true)}
                onCancel={() => settle(false)}
            />
        ) : null,
    }
}
