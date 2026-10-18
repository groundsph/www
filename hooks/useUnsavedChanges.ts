"use client"

import { useEffect } from "react"

/**
 * Warn before a browser close or reload while there are unsaved edits.
 *
 * In-app navigation is not intercepted globally: the editors call `confirm()`
 * from `useConfirm()` in their own handlers, which keeps behaviour predictable.
 * This hook only covers the tab-level exits the app cannot intercept.
 */
export function useUnsavedChanges(dirty: boolean): void {
    useEffect(() => {
        if (!dirty) return

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ""
        }

        window.addEventListener("beforeunload", handleBeforeUnload)
        return () => window.removeEventListener("beforeunload", handleBeforeUnload)
    }, [dirty])
}
