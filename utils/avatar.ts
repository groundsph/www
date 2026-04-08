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

export const AVATAR_COLORS = [
    "#74512d", // primary
    "#5e3d1f", // primary darkened
    "#bc6c25", // accent
    "#9a5620", // accent darkened
    "#8b6543", // primary-secondary mid
    "#6b4423", // deeper brown
    "#4a2e15", // darkest brown
    "#7a5a3a", // warm mid
] as const

/**
 * Generates a deterministic color from a string using the project palette.
 * Picks from a curated set of warm brown/accent colors that match the Grounds brand.
 */
export function getAvatarColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
}
