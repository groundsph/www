// Badge catalogue + unlock rules.
//
// Pure data and pure decision helpers — no database imports — so the rules can
// be shared with UI copy and unit tested without a live connection.

import type { IslandGroup } from "@/utils/badges/island-groups"

export const BADGE_NAMES = {
    SCOUT: "Scout",
    EXPLORER: "Explorer",
    PATHFINDER: "Pathfinder",
    CONNOISSEUR: "Connoisseur",
    ISLAND_HOPPER: "Island Hopper",
    KAPE_NG_PAMBANSA: "Kape-ng Pambansa",
    EYE_SPY: "Eye Spy",
    GROUNDS_SUPPORTER: "Grounds Supporter",
    // Visit badges
    REGULAR: "Regular",
    LOYAL_CUSTOMER: "Loyal Customer",
} as const

export type BadgeName = (typeof BADGE_NAMES)[keyof typeof BADGE_NAMES]

/** Published cafes contributed before each scouting badge unlocks. */
export const SCOUT_THRESHOLDS = [
    { count: 5, badge: BADGE_NAMES.SCOUT },
    { count: 10, badge: BADGE_NAMES.EXPLORER },
    { count: 20, badge: BADGE_NAMES.PATHFINDER },
] as const

/** Published reviews before the review badge unlocks. */
export const CONNOISSEUR_THRESHOLD = 5

/** Repeated visits to a single cafe before each visit badge unlocks. */
export const VISIT_THRESHOLDS = [
    { count: 5, badge: BADGE_NAMES.REGULAR },
    { count: 10, badge: BADGE_NAMES.LOYAL_CUSTOMER },
] as const

/**
 * Distinct island groups visited before each geographic badge unlocks.
 * 2 groups -> Island Hopper, all 3 -> Kape-ng Pambansa.
 */
export const ISLAND_GROUP_THRESHOLDS = [
    { groups: 2, badge: BADGE_NAMES.ISLAND_HOPPER },
    { groups: 3, badge: BADGE_NAMES.KAPE_NG_PAMBANSA },
] as const

/**
 * Which geographic badges a given island-group coverage unlocks.
 */
export function getGeographicBadgesForGroups(
    groups: Iterable<IslandGroup>
): string[] {
    const unique = new Set(groups)
    return ISLAND_GROUP_THRESHOLDS.filter(
        (threshold) => unique.size >= threshold.groups
    ).map((threshold) => threshold.badge)
}
