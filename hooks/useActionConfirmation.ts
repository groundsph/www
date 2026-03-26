"use client"

import { useState, useCallback } from "react"
import { type SensitiveAction } from "@/lib/action-confirmation"

interface PendingAction {
    action: SensitiveAction
    actionName: string
    description?: string
    onConfirmed: () => void
    onCancel?: () => void
}

interface UseActionConfirmationReturn {
    isModalOpen: boolean
    pendingAction: PendingAction | null
    requestConfirmation: (
        action: SensitiveAction,
        actionName: string,
        description?: string,
        onCancel?: () => void
    ) => Promise<boolean>
    closeModal: () => void
    handleConfirmed: () => void
}

/**
 * Hook for managing action confirmation flow
 * 
 * Usage:
 * ```tsx
 * const { requestConfirmation, isModalOpen, pendingAction, closeModal, handleConfirmed } = useActionConfirmation()
 * 
 * const handleDelete = async () => {
 *   const confirmed = await requestConfirmation(
 *     "cafe:delete",
 *     "Delete Cafe",
 *     "This will permanently delete the cafe and all associated data."
 *   )
 *   if (confirmed) {
 *     // Execute the action
 *   }
 * }
 * ```
 */
export function useActionConfirmation(): UseActionConfirmationReturn {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null)

    const requestConfirmation = useCallback(
        (
            action: SensitiveAction,
            actionName: string,
            description?: string,
            onCancel?: () => void
        ): Promise<boolean> => {
            return new Promise((resolve) => {
                setResolvePromise(() => resolve)
                setPendingAction({
                    action,
                    actionName,
                    description,
                    onConfirmed: () => {
                        resolve(true)
                        setIsModalOpen(false)
                        setPendingAction(null)
                    },
                    onCancel: () => {
                        resolve(false)
                        setIsModalOpen(false)
                        setPendingAction(null)
                        onCancel?.()
                    },
                })
                setIsModalOpen(true)
            })
        },
        []
    )

    const closeModal = useCallback(() => {
        if (resolvePromise) {
            resolvePromise(false)
        }
        setIsModalOpen(false)
        setPendingAction(null)
    }, [resolvePromise])

    const handleConfirmed = useCallback(() => {
        if (pendingAction) {
            pendingAction.onConfirmed()
        }
    }, [pendingAction])

    return {
        isModalOpen,
        pendingAction,
        requestConfirmation,
        closeModal,
        handleConfirmed,
    }
}
