export const COMMUNITY_TAB_ORDER = ["blogs", "crawls", "collections", "events", "leaderboard"] as const
export type CommunityTab = typeof COMMUNITY_TAB_ORDER[number]
