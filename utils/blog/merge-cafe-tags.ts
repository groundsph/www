export function mergeCafeTags(explicitIds: string[], detectedIds: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const id of [...explicitIds, ...detectedIds]) {
        if (!seen.has(id)) {
            seen.add(id)
            result.push(id)
        }
    }
    return result
}
