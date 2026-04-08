/**
 * Shared utilities and types for cafe form management.
 * Used by CafeEditor, CafeEditClient, CafeSubmissionForm, and SuggestEditModal.
 */

/**
 * Color scheme for theming shared components.
 * Maps to Tailwind color classes used across admin (accent) and owner (primary) pages.
 */
export type ColorScheme = "primary" | "accent"

/**
 * Get Tailwind classes for a given color scheme
 */
export const getColorClasses = (scheme: ColorScheme) => ({
    // Background variants
    bg: scheme === "primary" ? "bg-primary" : "bg-accent",
    bgLight: scheme === "primary" ? "bg-primary/20" : "bg-accent/20",
    bgHover: scheme === "primary" ? "hover:bg-primary/30" : "hover:bg-accent/30",
    bgSelected:
        scheme === "primary" ? "bg-primary/20" : "bg-accent/20",

    // Text variants
    text: scheme === "primary" ? "text-primary" : "text-accent",

    // Border variants
    border: scheme === "primary" ? "border-primary" : "border-accent",
    borderLight:
        scheme === "primary" ? "border-primary/30" : "border-accent/30",

    // Ring variants (for focus states)
    ring: scheme === "primary" ? "ring-primary/50" : "ring-accent/50",
    focusRing:
        scheme === "primary"
            ? "focus:ring-primary/50"
            : "focus:ring-accent/50",
})

/**
 * Convert snake_case to Title Case.
 * Used for displaying specialty and tag labels.
 *
 * @example formatLabel("cold_brew") => "Cold Brew"
 */
export const formatLabel = (s: string): string =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * Check if an image file is approximately 16:9 aspect ratio.
 * Used for cover image validation.
 *
 * @param file - The image file to check
 * @returns Promise<boolean> - True if aspect ratio is within tolerance of 16:9
 */
export const checkAspectRatio = async (file: File): Promise<boolean> => {
    try {
        const bitmap = await createImageBitmap(file)
        const aspect = bitmap.width / bitmap.height
        bitmap.close()
        return Math.abs(aspect - 16 / 9) < 0.05
    } catch {
        return false
    }
}

/**
 * Create handlers for adding custom comma-separated items to an array field.
 * Used for specialties and tags inputs.
 *
 * @param currentItems - Current array of items
 * @param updateFn - Function to call with updated array
 * @returns Object with add and clear functions
 */
export const createCustomItemHandlers = (
    currentItems: string[] | null | undefined,
    updateFn: (items: string[]) => void
) => {
    return {
        /**
         * Parse comma-separated input, normalize to snake_case, and add unique items
         */
        add: (input: string): void => {
            if (!input.trim()) return
            const newItems = input
                .split(",")
                .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
                .filter((s) => s && !(currentItems || []).includes(s))

            if (newItems.length > 0) {
                updateFn([...(currentItems || []), ...newItems])
            }
        },
    }
}

/**
 * Move an item in an array from one index to another.
 * Used for reordering gallery images.
 *
 * @param array - The array to modify
 * @param fromIndex - Current index of item
 * @param direction - Direction to move ("left" decreases index, "right" increases)
 * @returns New array with item moved, or original array if move is invalid
 */
export const moveArrayItem = <T,>(
    array: T[],
    fromIndex: number,
    direction: "left" | "right"
): T[] => {
    if (
        (direction === "left" && fromIndex === 0) ||
        (direction === "right" && fromIndex === array.length - 1)
    ) {
        return array
    }

    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1
    const newArray = [...array]
    const [movedItem] = newArray.splice(fromIndex, 1)
    newArray.splice(toIndex, 0, movedItem)
    return newArray
}

/**
 * Price level configuration for UI display
 */
export const PRICE_LEVELS = [
    { value: "low" as const, level: 1, label: "₱", description: "Budget-friendly" },
    { value: "medium" as const, level: 2, label: "₱₱", description: "Mid-range" },
    { value: "high" as const, level: 3, label: "₱₱₱", description: "Premium" },
]

/**
 * Common form section configuration
 */
export type CafeFormSection =
    | "basic"
    | "images"
    | "location"
    | "amenities"
    | "hours"
    | "contact"
    | "story"
    | "menu"
    | "owners"
