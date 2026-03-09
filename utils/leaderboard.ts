export interface LeaderboardEntry {
  userId: string
  visitCount: number
  [key: string]: unknown
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number
}

/**
 * Apply tie-aware ranking to sorted leaderboard entries.
 * Users with the same score receive the same rank.
 * Uses dense ranking: next unique score gets next consecutive rank (1, 1, 2 pattern for ties).
 *
 * @param entries - Array sorted by score field DESC, username ASC
 * @returns Array with rank property added
 */
export function applyTieRanking<T extends LeaderboardEntry>(
  entries: T[]
): (T & { rank: number })[] {
  if (entries.length === 0) return []

  const result: (T & { rank: number })[] = []
  let currentRank = 1

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    
    // If not the first entry and visit count differs from previous,
    // increment rank (dense ranking - no skipping)
    if (i > 0 && entry.visitCount !== entries[i - 1].visitCount) {
      currentRank++
    }
    
    result.push({ ...entry, rank: currentRank })
  }

  return result
}
