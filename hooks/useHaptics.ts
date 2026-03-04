"use client"

import { useWebHaptics } from "web-haptics/react"
import type { defaultPatterns } from "web-haptics"

// Named preset type derived from the library
export type HapticPattern = keyof typeof defaultPatterns | "light" | "medium" | "heavy" | "rigid" | "soft" | "selection" | "nudge" | "success" | "warning" | "error"

/**
 * Thin wrapper around useWebHaptics.
 * Use this instead of importing from web-haptics directly.
 * Resolves to a no-op on unsupported devices automatically.
 */
export function useHaptics() {
    const { trigger, cancel, isSupported } = useWebHaptics()
    return { trigger, cancel, isSupported }
}
