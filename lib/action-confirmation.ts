/**
 * Client-safe action confirmation types and utilities
 * This file should NOT import server-only modules like next/headers or db
 */

export type ConfirmationMethod = "passkey" | "totp" | "password"

export interface UserConfirmationStatus {
    hasPasskey: boolean
    hasTOTP: boolean
    hasPassword: boolean
    preferredMethod: ConfirmationMethod | null
    availableMethods: ConfirmationMethod[]
}

export interface ActionConfirmationResult {
    success: boolean
    error?: string
    method?: ConfirmationMethod
}

/**
 * Actions that require confirmation before execution
 * These are sensitive operations that need additional verification
 */
export const ACTIONS_REQUIRING_CONFIRMATION = [
    "cafe:delete",
    "cafe:permanent-delete",
    "user:ban",
    "user:unban",
    "user:role-change",
    "user:delete",
    "review:delete",
    "blog:delete",
    "event:delete",
    "system:settings-update",
    "system:maintenance-mode",
] as const

export type SensitiveAction = (typeof ACTIONS_REQUIRING_CONFIRMATION)[number]

/**
 * Check if a specific action requires confirmation
 */
export function actionRequiresConfirmation(action: string): action is SensitiveAction {
    return ACTIONS_REQUIRING_CONFIRMATION.includes(action as SensitiveAction)
}

/**
 * Get the display name for a sensitive action
 */
export function getActionDisplayName(action: SensitiveAction): string {
    const displayNames: Record<SensitiveAction, string> = {
        "cafe:delete": "Delete Cafe",
        "cafe:permanent-delete": "Permanently Delete Cafe",
        "user:ban": "Ban User",
        "user:unban": "Unban User",
        "user:role-change": "Change User Role",
        "user:delete": "Delete User",
        "review:delete": "Delete Review",
        "blog:delete": "Delete Blog Post",
        "event:delete": "Delete Event",
        "system:settings-update": "Update System Settings",
        "system:maintenance-mode": "Toggle Maintenance Mode",
    }
    return displayNames[action] || action
}

// Server actions are exported from app/api/actions/action-confirmation.ts
// Client components should import types from this file only
