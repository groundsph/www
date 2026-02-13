/**
 * Stamp helper utilities for badge stamp fallback logic
 */

/**
 * Get the badge stamp URL with fallback behavior
 * @param cafeName - Name of the cafe (for potential future fallback logic)
 * @param customUrl - Custom badge stamp URL from the cafe
 * @returns The custom URL if present and valid, null otherwise
 */
export function getStampFallback(
    _cafeName: string,
    customUrl: string | null | undefined
): string | null {
    if (!customUrl || customUrl.trim() === "") {
        return null
    }
    return customUrl
}
