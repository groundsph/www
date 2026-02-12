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
 * Users with the same visit count receive the same rank.
 * Ranks are skipped appropriately (1, 1, 3 pattern for ties).
 * 
 * @param entries - Array sorted by visitCount DESC, username ASC
 * @returns Array with rank property added
 */
export function applyTieRanking<T extends LeaderboardEntry>(
  entries: T[]
): (T & { rank: number })[] {
  if (entries.length === 0) return []

  const result: (T & { rank: number })[] = []
  let currentRank = 1
  let processedCount = 0

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    
    // If not the first entry and visit count differs from previous,
    // update rank to skip tied positions
    if (i > 0 && entry.visitCount !== entries[i - 1].visitCount) {
      currentRank = processedCount + 1
    }
    
    result.push({ ...entry, rank: currentRank })
    processedCount++
  }

  return result
}
