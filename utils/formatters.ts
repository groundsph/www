export function formatCafeStrawType(type?: string | null, other?: string | null) {
    if (!type) return null
    if (type === "other" && other) return other
    return type.replace(/_/g, " ")
}
