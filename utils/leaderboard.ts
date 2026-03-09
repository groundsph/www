export interface LeaderboardEntry {
  userId: string
  visitCount?: number
  score?: number
  [key: string]: unknown
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number
}

export interface TieRankingOptions {
  scoreKey?: "visitCount" | "score"
}

/**
 * Apply tie-aware ranking to sorted leaderboard entries.
 * Users with the same score receive the same rank.
 * Uses dense ranking: next unique score gets next consecutive rank (1, 1, 2 pattern for ties).
 *
 * @param entries - Array sorted by score field DESC, username ASC
 * @param options - Optional configuration for ranking
 * @returns Array with rank property added
 */
export function applyTieRanking<T extends LeaderboardEntry>(
  entries: T[],
  options: TieRankingOptions = {}
): (T & { rank: number })[] {
  if (entries.length === 0) return []

  const { scoreKey = "visitCount" } = options
  const result: (T & { rank: number })[] = []
  let currentRank = 1

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const currentScore = entry[scoreKey] as number
    const previousScore = i > 0 ? (entries[i - 1][scoreKey] as number) : undefined
    
    // If not the first entry and score differs from previous,
    // increment rank (dense ranking - no skipping)
    if (i > 0 && currentScore !== previousScore) {
      currentRank++
    }
    
    result.push({ ...entry, rank: currentRank })
  }

  return result
}
