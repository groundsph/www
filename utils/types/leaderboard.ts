export interface UserLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  visitCount: number;
  score: number;
}

export interface CafeLeaderboardEntry {
  rank: number;
  nationwideRank?: number | null;
  cafeId: string;
  name: string;
  slug: string;
  thumbnail: string;
  region: string;
  score: number;
  visitCount: number;
  reviewCount: number;
  avgRating: number | null;
}

export interface LeaderboardSnapshotRow {
  yearMonth: string;
  type: "user" | "cafe";
  entityId: string;
  rank: number;
  score: number;
  breakdown: Record<string, unknown> | null;
  region: string | null;
}
