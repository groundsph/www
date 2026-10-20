// Philippine island group classification.
//
// Pure data/helpers only — deliberately NOT a "use server" module so it can be
// imported by server actions, cron jobs, scripts and tests alike.
//
// Regions match the labels in `utils/data/philippines.ts` (PSGC naming), but the
// lookup also resolves by the region *code* (e.g. "Region IV-A", "NCR", "BARMM")
// so a future relabel of the human-readable name cannot silently break badges.

export type IslandGroup = "luzon" | "visayas" | "mindanao"

export const ISLAND_GROUPS: readonly IslandGroup[] = [
    "luzon",
    "visayas",
    "mindanao",
] as const

export const ISLAND_GROUP_LABELS: Record<IslandGroup, string> = {
    luzon: "Luzon",
    visayas: "Visayas",
    mindanao: "Mindanao",
}

/**
 * Canonical region -> island group map, keyed by the PSGC region code.
 * Codes are stable; the descriptive suffix is not.
 */
const REGION_CODE_TO_ISLAND_GROUP: Record<string, IslandGroup> = {
    NCR: "luzon",
    "REGION I": "luzon",
    "REGION II": "luzon",
    "REGION III": "luzon",
    "REGION IV-A": "luzon",
    "REGION IV-B": "luzon",
    "REGION V": "luzon",
    CAR: "luzon",

    "REGION VI": "visayas",
    "REGION VII": "visayas",
    "REGION VIII": "visayas",

    "REGION IX": "mindanao",
    "REGION X": "mindanao",
    "REGION XI": "mindanao",
    "REGION XII": "mindanao",
    "REGION XIII": "mindanao",
    BARMM: "mindanao",
}

/**
 * Alternative spellings seen in the wild (Nominatim / manually entered cafes).
 * Keyed by normalized alias -> region code.
 */
const REGION_ALIASES: Record<string, string> = {
    "national capital region": "NCR",
    "metro manila": "NCR",
    "ncr": "NCR",

    ilocos: "REGION I",
    "ilocos region": "REGION I",

    "cagayan valley": "REGION II",

    "central luzon": "REGION III",

    calabarzon: "REGION IV-A",
    "southern tagalog": "REGION IV-A",

    mimaropa: "REGION IV-B",
    "southwestern tagalog": "REGION IV-B",

    bicol: "REGION V",
    "bicol region": "REGION V",

    "western visayas": "REGION VI",

    "central visayas": "REGION VII",

    "eastern visayas": "REGION VIII",

    "zamboanga peninsula": "REGION IX",

    "northern mindanao": "REGION X",

    "davao region": "REGION XI",
    "davao": "REGION XI",

    soccsksargen: "REGION XII",

    caraga: "REGION XIII",

    bangsamoro: "BARMM",
    "bangsamoro autonomous region in muslim mindanao": "BARMM",
    arm: "BARMM",

    cordillera: "CAR",
    "cordillera administrative region": "CAR",
}

function normalize(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ")
}

// Ordinal region codes, longest first so "XIII" is not clipped to "X".
const REGION_ORDINALS = [
    "XIII",
    "XII",
    "XI",
    "VIII",
    "VII",
    "VI",
    "IX",
    "IV-A",
    "IV-B",
    "III",
    "II",
    "X",
    "V",
    "I",
] as const

const SHORT_CODES = ["NCR", "CAR", "BARMM"] as const

function resolveRegionCode(raw: string): string | null {
    const upper = raw.toUpperCase()

    // 1. Full label -> alias table (e.g. "Central Visayas", "Metro Manila").
    const alias = REGION_ALIASES[normalize(raw)]
    if (alias) return alias

    // 2. "Region <ordinal>" anywhere in the string, longest ordinal first.
    for (const ordinal of REGION_ORDINALS) {
        const pattern = new RegExp(`\\bREGION\\s+${ordinal.replace("-", "\\-")}\\b`)
        if (pattern.test(upper)) return `REGION ${ordinal}`
    }

    // 3. Standalone short codes (NCR / CAR / BARMM).
    for (const code of SHORT_CODES) {
        if (new RegExp(`\\b${code}\\b`).test(upper)) return code
    }

    return null
}

/**
 * Resolve a region label/code to its island group.
 * Returns null for anything unrecognised so callers can ignore bad data
 * instead of guessing.
 */
export function getIslandGroup(regionName: string | null | undefined): IslandGroup | null {
    if (!regionName) return null

    const raw = regionName.trim()
    if (!raw) return null

    const code = resolveRegionCode(raw)
    if (!code) return null

    return REGION_CODE_TO_ISLAND_GROUP[code] ?? null
}

/**
 * Collapse a list of region labels into the set of island groups covered.
 */
export function getIslandGroupsFromRegions(
    regions: Iterable<string | null | undefined>,
): Set<IslandGroup> {
    const groups = new Set<IslandGroup>()
    for (const region of regions) {
        const group = getIslandGroup(region)
        if (group) groups.add(group)
    }
    return groups
}
