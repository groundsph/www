/**
 * Extracts initials from a display name.
 * - Single word: first letter
 * - Multiple words: first letter of first and last word
 * - Empty: "?"
 */
export function getInitials(name: string): string {
    const trimmed = name.trim()
    if (!trimmed) return "?"

    const words = trimmed.split(/\s+/).filter(Boolean)
    if (words.length === 1) return words[0][0]!.toUpperCase()

    return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase()
}

/**
 * Generates a deterministic HSL color from a string.
 * Uses a simple hash to pick a hue, with fixed saturation and lightness
 * for consistent readability with white text.
 */
export function getAvatarColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
        hash = hash & hash // Convert to 32-bit int
    }

    const hue = Math.abs(hash) % 360
    const saturation = 60
    const lightness = 45

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
