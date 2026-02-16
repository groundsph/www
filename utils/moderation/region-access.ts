import { db } from "@/db"
import { profiles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth"

export function normalizeRegions(regions?: string[] | null): string[] {
    if (!regions) return []
    const seen = new Set<string>()
    const result: string[] = []
    for (const region of regions) {
        const normalized = region.trim()
        if (!normalized || seen.has(normalized)) continue
        seen.add(normalized)
        result.push(normalized)
    }
    return result
}

export function canAccessRegion(
    regions: string[] | null | undefined,
    targetRegion: string | null | undefined
): boolean {
    const normalized = normalizeRegions(regions)
    if (normalized.length === 0) return true
    if (!targetRegion) return false
    return normalized.includes(targetRegion)
}

/**
 * Get the moderator regions for the current user.
 * Returns empty array for admins or moderators without region restrictions (access to all).
 * Returns array of regions for moderators with region restrictions.
 */
export async function getModeratorRegionsForCurrentUser(): Promise<string[]> {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

    const result = await db.select({ role: profiles.role, regions: profiles.moderatorRegions })
        .from(profiles)
        .where(eq(profiles.id, currentUser.id))
        .limit(1)

    if (result[0]?.role !== "moderator") return []
    return normalizeRegions(result[0]?.regions ?? [])
}
