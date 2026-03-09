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
