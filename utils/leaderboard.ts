export interface LeaderboardEntry {
  userId?: string
  visitCount: number
  [key: string]: unknown
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number
}

/**
 * Apply tie-aware ranking to sorted leaderboard entries.
 * Users with the same visit count receive the same rank.
 * Uses dense ranking: next unique score gets next consecutive rank (1, 1, 2 pattern for ties).
 * 
 * @param entries - Array sorted by visitCount DESC, username ASC
 * @returns Array with rank property added
 */
export function applyTieRanking<T extends LeaderboardEntry>(
  entries: T[],
  options?: { scoreKey?: keyof T }
): (T & { rank: number })[] {
  if (entries.length === 0) return []

  const scoreKey = (options?.scoreKey ?? "visitCount") as keyof T
  const result: (T & { rank: number })[] = []
  let currentRank = 1

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const prev = entries[i - 1]

    if (i > 0 && entry[scoreKey] !== prev[scoreKey]) {
      currentRank++
    }

    result.push({ ...entry, rank: currentRank })
  }

  return result
}
