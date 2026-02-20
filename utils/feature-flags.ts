/**
 * Feature flags for the application
 */

/**
 * Check if chat is enabled via environment variable
 * @returns boolean indicating if chat is available
 */
export function getChatEnabled(): boolean {
    return process.env.ENABLE_CHAT !== "false"
}
