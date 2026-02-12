export function groupByRank<T extends { rank: number }>(
    entries: T[]
): Record<number, T[]> {
    return entries.reduce((acc, entry) => {
        const rank = entry.rank
        if (!acc[rank]) {
            acc[rank] = []
        }
        acc[rank].push(entry)
        return acc
    }, {} as Record<number, T[]>)
}
