/**
 * Format cafe straw type for display
 * - Returns "other" value when type is "other"
 * - Converts snake_case to spaces
 * - Returns null for empty/null types
 */
export function formatCafeStrawType(
    type: string | null,
    otherValue: string | null
): string | null {
    if (!type || type === "") {
        return null
    }

    if (type === "other") {
        return otherValue || null
    }

    // Convert snake_case to spaces
    return type.replace(/_/g, " ")
}
