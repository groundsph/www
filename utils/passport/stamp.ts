/**
 * Stamp helper utilities for badge stamp fallback logic
 */

/**
 * Select the appropriate stamp image URL
 * Prefers custom stamp URL if provided, otherwise returns null (caller should use fallback)
 * @param cafeName - Name of the cafe (for potential future fallback logic)
 * @param customUrl - Custom badge stamp URL from the cafe
 * @returns The custom URL if present and valid, null otherwise
 */
export function selectStampImage(
    _cafeName: string,
    customUrl: string | null | undefined
): string | null {
    if (!customUrl || customUrl.trim() === "") {
        return null
    }
    return customUrl
}

/**
 * Get the badge stamp URL with fallback behavior
 * @deprecated Use selectStampImage instead
 */
export function getStampFallback(
    cafeName: string,
    customUrl: string | null | undefined
): string | null {
    return selectStampImage(cafeName, customUrl)
}
