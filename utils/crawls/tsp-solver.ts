export function solveTspExact(matrix: number[][], startIndex = 0): number[] {
    const n = matrix.length
    if (n <= 1) return [0]

    const fullMask = (1 << n) - 1
    const dp = new Map<string, { cost: number; prev: number }>()

    for (let i = 0; i < n; i++) {
        if (i === startIndex) continue
        const mask = (1 << startIndex) | (1 << i)
        dp.set(`${mask}:${i}`, { cost: matrix[startIndex][i], prev: startIndex })
    }

    for (let mask = 0; mask <= fullMask; mask++) {
        if ((mask & (1 << startIndex)) === 0) continue
        for (let last = 0; last < n; last++) {
            if (last === startIndex || (mask & (1 << last)) === 0) continue
            const entry = dp.get(`${mask}:${last}`)
            if (!entry) continue
            for (let next = 0; next < n; next++) {
                if (mask & (1 << next)) continue
                const nextMask = mask | (1 << next)
                const nextCost = entry.cost + matrix[last][next]
                const key = `${nextMask}:${next}`
                const existing = dp.get(key)
                if (!existing || nextCost < existing.cost) {
                    dp.set(key, { cost: nextCost, prev: last })
                }
            }
        }
    }

    let bestLast = startIndex
    let bestCost = Number.POSITIVE_INFINITY
    for (let last = 0; last < n; last++) {
        if (last === startIndex) continue
        const entry = dp.get(`${fullMask}:${last}`)
        if (entry && entry.cost < bestCost) {
            bestCost = entry.cost
            bestLast = last
        }
    }

    const order = [bestLast]
    let mask = fullMask
    let last = bestLast
    while (last !== startIndex) {
        const entry = dp.get(`${mask}:${last}`)
        if (!entry) break
        order.push(entry.prev)
        mask = mask & ~(1 << last)
        last = entry.prev
    }
    return order.reverse()
}
